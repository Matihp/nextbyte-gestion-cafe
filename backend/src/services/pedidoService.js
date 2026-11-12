const crypto = require('crypto');
const { dbLocal } = require('../config/db');
const AppError = require('../utils/AppError');
const { ESTADOS_PEDIDO, ESTADOS_ACTIVOS } = require('../utils/constantes');
const { hoy, ahora } = require('../utils/fechas');
const { validarPedido } = require('../dtos/pedido.dto');
const pedidoRepository = require('../repositories/pedidoRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');
const productoRepository = require('../repositories/productoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const registroMermaRepository = require('../repositories/registroMermaRepository');

const generarIdPedido = () => {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `PED-${hex}`;
};

const calcularTotal = (items = []) => {
  const total = items.reduce((acc, item) => {
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precio_venta || 0);
    return acc + cantidad * precio;
  }, 0);
  return Number(total.toFixed(2));
};

const calcularCostoUnitario = (ingredientes = []) => {
  if (!Array.isArray(ingredientes) || ingredientes.length === 0) return 0;
  const costo = ingredientes.reduce((acc, ing) => {
    const cantidad = Number(ing.cantidad || 0);
    const precioCosto = Number(ing.precio_costo ?? ing.insumo?.precio_costo ?? 0);
    return acc + cantidad * precioCosto;
  }, 0);
  return Number(costo.toFixed(2));
};

const hashPayload = (datos) => {
  // Canonicalizar propiedades sin alterar tipos ni el orden de los ítems.
  const estable = (valor) => {
    if (Array.isArray(valor)) return `[${valor.map(estable).join(',')}]`;
    if (valor !== null && typeof valor === 'object') {
      return `{${Object.keys(valor).sort().map((key) => `${JSON.stringify(key)}:${estable(valor[key])}`).join(',')}}`;
    }
    return JSON.stringify(valor);
  };
  try {
    const json = JSON.parse(JSON.stringify(datos));
    return crypto.createHash('sha256').update(estable(json)).digest('hex');
  } catch {
    throw new AppError('El payload debe ser JSON válido', 400, 'VALIDACION');
  }
};

const buscarReplay = async (key, hash, trx = null) => {
  const existente = await (trx || dbLocal)('pedidos').where({ idempotency_key: key }).first();
  if (!existente) return null;
  if (existente.idempotency_hash !== hash) {
    throw new AppError('La Idempotency-Key ya fue utilizada con otro payload', 409, 'IDEMPOTENCY_CONFLICT');
  }
  return pedidoRepository.getWithDetails(existente.id, trx);
};

const esConflictoIdempotencyKey = (error) => {
  const vistos = new Set();
  for (let actual = error; actual && !vistos.has(actual); actual = actual.cause) {
    vistos.add(actual);
    if (['SQLITE_CONSTRAINT', 'SQLITE_CONSTRAINT_UNIQUE'].includes(actual.code)
      && /\bUNIQUE constraint failed: pedidos\.idempotency_key\s*$/.test(actual.message || '')) {
      return true;
    }
  }
  return false;
};

const crear = async (datos, opciones = {}) => {
  const key = opciones.idempotencyKey;
  if (key !== undefined && (typeof key !== 'string' || key.length === 0 || key.length > 128 || /[^A-Za-z0-9._:-]/.test(key))) {
    throw new AppError('Idempotency-Key debe tener entre 1 y 128 caracteres alfanuméricos o . _ : -', 400, 'VALIDACION');
  }
  const hash = key === undefined ? null : hashPayload(datos);
  if (key !== undefined) {
    const replay = await buscarReplay(key, hash);
    if (replay) return replay;
  }

  const errores = validarPedido(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  try {
    return await dbLocal.transaction(async (trx) => {
      if (key !== undefined) {
        const replay = await buscarReplay(key, hash, trx);
        if (replay) return replay;
      }
      const cabecera = {
        id: generarIdPedido(),
        cliente: typeof datos.cliente === 'string' && datos.cliente.trim() !== ''
          ? datos.cliente.trim() : 'Consumidor Final',
        total: 0,
        estado: datos.estado || ESTADOS_PEDIDO.PENDIENTE,
        tipo_pedido: datos.tipo_pedido,
        metodo_pago: datos.metodo_pago,
        direccion: datos.direccion ? datos.direccion.trim() : null,
        telefono: datos.telefono ? datos.telefono.trim() : null,
        fecha: hoy(),
        hora: ahora()
      };
      if (key !== undefined) {
        // Reclamar la clave antes de validar stock. Cabecera, clave y reservas
        // se confirman juntas; un conflicto único revierte toda esta transacción.
        await pedidoRepository.create(cabecera, trx);
        await trx('pedidos').where({ id: cabecera.id }).update({
          idempotency_key: key,
          idempotency_hash: hash
        });
      }
      const detalles = [];
      for (const item of datos.items) {
        const producto = await productoRepository.getByIdWithDetails(Number(item.producto_id), trx);
        if (!producto) {
          throw new AppError(`El producto con id ${item.producto_id} no existe`, 404, 'NO_ENCONTRADO');
        }

        const cantPedida = item.cantidad;
        const afectados = await trx('productos')
          .where({ id: producto.id })
          .where('stock_actual', '>=', cantPedida)
          .decrement('stock_actual', cantPedida)
          .update({ updated_at: trx.fn.now() });
        if (afectados !== 1) {
          throw new AppError(
            `No hay productos suficientes de "${producto.nombre}". Disponibles: ${producto.stock_actual}, solicitados: ${cantPedida}`,
            409,
            'STOCK_INSUFICIENTE'
          );
        }

        detalles.push({
          producto_id: producto.id,
          nombre_producto: producto.nombre,
          cantidad: cantPedida,
          precio_venta: Number(producto.precio_venta),
          precio_costo: Number(producto.precio_costo) || 0
        });
      }

      const total = calcularTotal(detalles);
      let pedidoCreado;
      if (key !== undefined) {
        await detallePedidoRepository.createMany(detalles.map((detalle) => ({
          ...detalle, pedido_id: cabecera.id
        })), trx);
        await pedidoRepository.update(cabecera.id, { total }, trx);
        pedidoCreado = await pedidoRepository.getWithDetails(cabecera.id, trx);
      } else {
        pedidoCreado = await pedidoRepository.createWithDetails({ ...cabecera, total }, detalles, trx);
      }

      // Si estamos operando offline en contingencia, registrar atómicamente en la outbox de SQLite
      if (process.env.CONTINGENCY_ENABLED === 'true') {
        try {
          const { requestContext } = require('../config/db');
          const store = requestContext ? requestContext.getStore() : null;
          if (store?.isOfflineContingency) {
            const { recordOfflineOperation } = require('./operationJournalService');
            const { EffectCollector } = require('./effectCollector');
            const collector = new EffectCollector();

            const cabeceraData = {
              id: pedidoCreado.id,
              cliente: pedidoCreado.cliente,
              total: Number(pedidoCreado.total || 0),
              estado: pedidoCreado.estado,
              tipo_pedido: pedidoCreado.tipo_pedido,
              metodo_pago: pedidoCreado.metodo_pago,
              direccion: pedidoCreado.direccion || null,
              telefono: pedidoCreado.telefono || null,
              fecha: pedidoCreado.fecha,
              hora: pedidoCreado.hora,
              numero_pedido: pedidoCreado.numero_pedido || null,
              idempotency_key: pedidoCreado.idempotency_key || null,
              idempotency_hash: pedidoCreado.idempotency_hash || null,
              created_at: pedidoCreado.created_at,
              updated_at: pedidoCreado.updated_at
            };
            collector.recordInsert('pedidos', pedidoCreado.id, cabeceraData);

            if (Array.isArray(pedidoCreado.detalles)) {
              for (const det of pedidoCreado.detalles) {
                collector.recordInsert('detalles_pedidos', det.id, {
                  id: det.id,
                  pedido_id: pedidoCreado.id,
                  producto_id: det.producto_id || null,
                  nombre_producto: det.nombre_producto,
                  cantidad: Number(det.cantidad || 1),
                  precio_venta: Number(det.precio_venta || 0),
                  precio_costo: Number(det.precio_costo || 0),
                  created_at: det.created_at,
                  updated_at: det.updated_at
                });

                if (det.producto_id) {
                  const prod = await trx('productos').where({ id: det.producto_id }).first();
                  if (prod) {
                    collector.recordUpdate('productos', det.producto_id, {
                      stock_actual: prod.stock_actual,
                      updated_at: prod.updated_at
                    });
                  }
                }
              }
            }

            await recordOfflineOperation(trx, {
              operationId: cabecera.id,
              actorId: 'cajero_principal',
              operationType: 'CREAR_PEDIDO',
              requestHash: hash || cabecera.id,
              requestPayload: datos,
              collector,
              result: pedidoCreado,
              status: 'pending'
            });
          } else {
            // Replicar al espejo local en contingencia.db de forma asíncrona
            const helper = (() => {
              try { return require('../config/contingencyDb'); } catch { return null; }
            })();
            if (helper && helper.isContingencyReady()) {
              const localDb = helper.getContingencyDb();
              (async () => {
                try {
                  const { detalles, display_id, displayId, orderNumber, ...cabeceraClean } = pedidoCreado;
                  const existe = await localDb('pedidos').where({ id: pedidoCreado.id }).first();
                  if (!existe) {
                    await localDb('pedidos').insert(cabeceraClean);
                  }
                  if (Array.isArray(detalles)) {
                    for (const d of detalles) {
                      const detExiste = await localDb('detalles_pedidos').where({ id: d.id }).first();
                      if (!detExiste) {
                        await localDb('detalles_pedidos').insert({
                          id: d.id,
                          pedido_id: pedidoCreado.id,
                          producto_id: d.producto_id || null,
                          nombre_producto: d.nombre_producto,
                          cantidad: Number(d.cantidad || 1),
                          precio_venta: Number(d.precio_venta || 0),
                          precio_costo: Number(d.precio_costo || 0),
                          created_at: d.created_at,
                          updated_at: d.updated_at
                        });
                      }
                    }
                  }
                } catch {}
              })().catch(() => {});
            }
          }
        } catch (e) {
          console.warn('Aviso al registrar en outbox:', e.message);
        }
      }

      return pedidoCreado;
    });
  } catch (error) {
    // Solo recuperar el conflicto de ESTA clave después de completar el rollback.
    // Errores de red, otras restricciones y commits inciertos nunca se reintentan.
    if (key !== undefined && esConflictoIdempotencyKey(error)) {
      const replay = await buscarReplay(key, hash);
      if (replay) return replay;
    }
    throw error;
  }
};

const obtenerTodos = async (filtros = {}) => pedidoRepository.getAll(filtros);

const obtenerPorId = async (id) => {
  const pedido = await pedidoRepository.getWithDetails(id);
  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NO_ENCONTRADO');
  }
  return pedido;
};

const actualizarPedido = async (pedido, cambios, trx) => {
  const afectados = await pedidoRepository.updateIfEstado(pedido.id, pedido.estado, cambios, trx);
  if (afectados !== 1) {
    throw new AppError('El pedido cambió de estado; vuelva a consultar', 409, 'ESTADO_INVALIDO');
  }
};

const devolverORegistrarMerma = async (detalle, opciones, trx) => {
  if (!opciones.esMerma) {
    if (detalle.producto_id) {
      const afectados = await trx('productos').where({ id: detalle.producto_id })
        .increment('stock_actual', Number(detalle.cantidad))
        .update({ updated_at: trx.fn.now() });
      if (afectados !== 1) {
        throw new AppError('No se pudo devolver el producto al stock', 409, 'STOCK_INVALIDO');
      }
    }
    return;
  }

  const producto = detalle.producto_id
    ? await productoRepository.getById(detalle.producto_id, trx)
    : null;
  const categoria = producto?.categoria_id
    ? await categoriaRepository.getById(producto.categoria_id, trx)
    : null;
  await registroMermaRepository.create({
    id: crypto.randomUUID(),
    producto_id: detalle.producto_id || null,
    nombre_producto: detalle.nombre_producto || 'Producto sin nombre',
    nombre_categoria: categoria?.nombre || null,
    motivo: 'MERMA',
    fecha: hoy(),
    cantidad: Number(detalle.cantidad),
    precio_costo: Number(detalle.precio_costo ?? producto?.precio_costo ?? 0)
  }, trx);
};

const cancelar = async (id, opciones = {}) => dbLocal.transaction(async (trx) => {
  const pedido = await pedidoRepository.getWithDetails(id, trx, true);
  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NO_ENCONTRADO');
  }
  if (pedido.estado === ESTADOS_PEDIDO.CANCELADO) {
    return pedido;
  }
  if (!ESTADOS_ACTIVOS.includes(pedido.estado)) {
    throw new AppError('No se puede cancelar un pedido completado o entregado', 409, 'ESTADO_INVALIDO');
  }

  await actualizarPedido(pedido, { estado: ESTADOS_PEDIDO.CANCELADO }, trx);
  for (const detalle of pedido.detalles) {
    await devolverORegistrarMerma(detalle, opciones, trx);
  }
  return pedidoRepository.getWithDetails(pedido.id, trx);
});

const eliminarItem = async (pedidoId, detalleId, opciones = {}) => dbLocal.transaction(async (trx) => {
  const pedido = await pedidoRepository.getWithDetails(pedidoId, trx, true);
  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NO_ENCONTRADO');
  }
  if (!ESTADOS_ACTIVOS.includes(pedido.estado)) {
    throw new AppError('No se puede modificar un pedido completado, entregado o cancelado', 409, 'ESTADO_INVALIDO');
  }

  const detalle = pedido.detalles.find((d) => d.id === detalleId);
  if (!detalle) {
    throw new AppError('El ítem no existe o no pertenece al pedido', 404, 'NO_ENCONTRADO');
  }
  const restantes = pedido.detalles.filter((d) => d.id !== detalleId);
  await actualizarPedido(pedido, {
    total: calcularTotal(restantes),
    estado: restantes.length ? pedido.estado : ESTADOS_PEDIDO.CANCELADO
  }, trx);
  const eliminados = await detallePedidoRepository.delete(detalle.id, trx);
  if (eliminados !== 1) {
    throw new AppError('El ítem ya fue modificado; vuelva a consultar', 409, 'ESTADO_INVALIDO');
  }
  await devolverORegistrarMerma(detalle, opciones, trx);
  return pedidoRepository.getWithDetails(pedido.id, trx);
});

module.exports = {
  generarIdPedido,
  calcularTotal,
  calcularCostoUnitario,
  crear,
  obtenerTodos,
  obtenerPorId,
  cancelar,
  eliminarItem
};
