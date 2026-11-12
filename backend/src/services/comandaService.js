const crypto = require('crypto');
const { ESTADOS_PEDIDO, ESTADOS_ACTIVOS } = require('../utils/constantes');
const { hoy } = require('../utils/fechas');
const AppError = require('../utils/AppError');
const { dbLocal } = require('../config/db');
const pedidoRepository = require('../repositories/pedidoRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');

const registroVentaRepository = require('../repositories/registroVentaRepository');

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS_PEDIDO.PENDIENTE]: [ESTADOS_PEDIDO.EN_PREPARACION],
  [ESTADOS_PEDIDO.EN_PREPARACION]: [ESTADOS_PEDIDO.EN_EMPAQUE],
  [ESTADOS_PEDIDO.COMPLETADO]: [ESTADOS_PEDIDO.ENTREGADO]
};

const puedeTransicionar = (estadoActual, estadoNuevo) => {
  const permitidos = TRANSICIONES_PERMITIDAS[estadoActual];
  if (!permitidos) {
    return false;
  }
  return permitidos.includes(estadoNuevo);
};

const normalizarConsumo = (consumo) => {
  const lista = [];
  if (!consumo) {
    return lista;
  }
  if (consumo instanceof Map || typeof consumo.entries === 'function') {
    for (const [k, v] of consumo.entries()) {
      const cantidad = typeof v === 'object' && v !== null ? (v.cantidad ?? 0) : v;
      lista.push({ insumo_id: Number(k), cantidad: Number(cantidad) });
    }
  } else if (Array.isArray(consumo)) {
    for (const item of consumo) {
      const id = item.insumo_id ?? item.insumoId ?? item.id;
      const cantidad = item.cantidad ?? item.cantidadRequerida ?? 0;
      lista.push({ insumo_id: Number(id), cantidad: Number(cantidad) });
    }
  } else if (typeof consumo === 'object') {
    for (const [k, v] of Object.entries(consumo)) {
      const cantidad = typeof v === 'object' && v !== null ? (v.cantidad ?? 0) : v;
      lista.push({ insumo_id: Number(k), cantidad: Number(cantidad) });
    }
  }
  return lista;
};

const obtenerStockDisponible = (stockPorInsumo, insumoId) => {
  if (!stockPorInsumo) {
    return { disponible: 0, nombre: `Insumo ${insumoId}` };
  }

  let item = null;
  if (stockPorInsumo instanceof Map || typeof stockPorInsumo.get === 'function') {
    item = stockPorInsumo.get(insumoId) ?? stockPorInsumo.get(String(insumoId)) ?? stockPorInsumo.get(Number(insumoId));
  } else if (Array.isArray(stockPorInsumo)) {
    item = stockPorInsumo.find((x) => Number(x.id ?? x.insumo_id) === Number(insumoId));
  } else if (typeof stockPorInsumo === 'object') {
    item = stockPorInsumo[insumoId] ?? stockPorInsumo[String(insumoId)];
  }

  if (item === undefined || item === null) {
    return { disponible: 0, nombre: `Insumo ${insumoId}` };
  }

  if (typeof item === 'number') {
    return { disponible: item, nombre: `Insumo ${insumoId}` };
  }

  const disponible = Number(item.cantidad_disponible ?? item.stock_actual ?? item.disponible ?? 0);
  const nombre = item.nombre || `Insumo ${insumoId}`;
  return { disponible, nombre };
};

const calcularConsumoInsumos = (detalles = [], recetasPorProducto) => {
  const consumoMap = new Map();
  if (!Array.isArray(detalles) || !recetasPorProducto) {
    return consumoMap;
  }

  for (const detalle of detalles) {
    const productoId = detalle.producto_id ?? detalle.productoId;
    const cantidadVendida = Number(detalle.cantidad || 0);
    if (cantidadVendida <= 0) {
      continue;
    }

    let receta = null;
    if (recetasPorProducto instanceof Map || typeof recetasPorProducto.get === 'function') {
      receta = recetasPorProducto.get(productoId) ?? recetasPorProducto.get(Number(productoId)) ?? recetasPorProducto.get(String(productoId));
    } else if (typeof recetasPorProducto === 'object') {
      receta = recetasPorProducto[productoId] ?? recetasPorProducto[String(productoId)];
    }

    if (!receta) {
      continue;
    }

    let ingredientes = [];
    if (Array.isArray(receta)) {
      ingredientes = receta;
    } else if (Array.isArray(receta.ingredientes)) {
      ingredientes = receta.ingredientes;
    }

    for (const ing of ingredientes) {
      const insumoId = Number(ing.insumo_id ?? ing.insumoId);
      const cantIngrediente = Number(ing.cantidad || 0);
      const totalIngrediente = cantIngrediente * cantidadVendida;
      const actual = consumoMap.get(insumoId) || 0;
      consumoMap.set(insumoId, Number((actual + totalIngrediente).toFixed(4)));
    }
  }

  return consumoMap;
};

const detectarFaltantes = (consumo, stockPorInsumo) => {
  const listaConsumo = normalizarConsumo(consumo);
  const faltantes = [];

  for (const item of listaConsumo) {
    const { disponible, nombre } = obtenerStockDisponible(stockPorInsumo, item.insumo_id);
    if (disponible < item.cantidad) {
      faltantes.push({
        insumo_id: item.insumo_id,
        nombre,
        requerido: item.cantidad,
        disponible,
        faltante: Number((item.cantidad - disponible).toFixed(4))
      });
    }
  }

  return faltantes;
};

const calcularTotalCosto = (detalles = []) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return 0;
  }
  const total = detalles.reduce((acc, detalle) => {
    const cantidad = Number(detalle.cantidad || 0);
    const precioCosto = Number(detalle.precio_costo ?? detalle.precioCosto ?? 0);
    return acc + (cantidad * precioCosto);
  }, 0);
  return Number(total.toFixed(2));
};

const obtenerActivas = async (opciones = {}) => {
  const estados = opciones.incluirCompletados
    ? ['pendiente', 'en_preparacion', 'en_empaque', 'completado']
    : ESTADOS_ACTIVOS;
  const pedidos = await pedidoRepository.getByEstados(estados);
  if (!pedidos || pedidos.length === 0) {
    return [];
  }

  const pedidoIds = pedidos.map((p) => p.id);
  const todosLosDetalles = await detallePedidoRepository.getByPedidoIds(pedidoIds);

  const detallesPorPedido = new Map();
  for (const det of todosLosDetalles) {
    if (!detallesPorPedido.has(det.pedido_id)) {
      detallesPorPedido.set(det.pedido_id, []);
    }
    detallesPorPedido.get(det.pedido_id).push(det);
  }

  return pedidos.map((pedido) => ({
    ...pedido,
    detalles: detallesPorPedido.get(pedido.id) || []
  }));
};

const cambiarEstado = async (id, nuevoEstado) => {
  const todosLosEstados = Object.values(ESTADOS_PEDIDO);
  if (!nuevoEstado || typeof nuevoEstado !== 'string' || !todosLosEstados.includes(nuevoEstado)) {
    throw new AppError('El estado proporcionado no es válido', 400, 'VALIDACION');
  }

  if (nuevoEstado === ESTADOS_PEDIDO.ENTREGADO) {
    return entregar(id);
  }

  return dbLocal.transaction(async (trx) => {
    const pedido = await pedidoRepository.getById(id, trx, true);
    if (!pedido) {
      throw new AppError('Pedido inexistente', 404, 'NO_ENCONTRADO');
    }
    if (!puedeTransicionar(pedido.estado, nuevoEstado)) {
      throw new AppError(`No se puede pasar de ${pedido.estado} a ${nuevoEstado}`, 409, 'TRANSICION_INVALIDA');
    }
    await actualizarEstado(pedido, nuevoEstado, trx);

    if (process.env.CONTINGENCY_ENABLED === 'true') {
      try {
        const { requestContext } = require('../config/db');
        const store = requestContext ? requestContext.getStore() : null;
        if (store?.isOfflineContingency) {
          const { recordOfflineOperation } = require('./operationJournalService');
          const { EffectCollector } = require('./effectCollector');
          const collector = new EffectCollector();
          collector.recordUpdate('pedidos', pedido.id, { estado: nuevoEstado }, { estado: pedido.estado });
          await recordOfflineOperation(trx, {
            operationId: `CMD_${pedido.id}_${Date.now()}`,
            actorId: 'cajero_principal',
            operationType: 'CAMBIAR_ESTADO_COMANDA',
            requestHash: `${pedido.id}_${nuevoEstado}`,
            requestPayload: { id: pedido.id, nuevoEstado },
            collector,
            result: { id: pedido.id, estado: nuevoEstado },
            status: 'pending'
          });
        }
      } catch (e) {
        console.warn('Aviso al registrar comanda en outbox:', e.message);
      }
    }

    return pedidoRepository.getWithDetails(pedido.id, trx);
  });
};

const actualizarEstado = async (pedido, estado, trx) => {
  const afectados = await pedidoRepository.updateIfEstado(pedido.id, pedido.estado, { estado }, trx);
  if (afectados !== 1) {
    throw new AppError('El pedido cambió de estado; vuelva a consultar', 409, 'TRANSICION_INVALIDA');
  }
};

const entregar = async (id) => dbLocal.transaction(async (trx) => {
  const pedido = await pedidoRepository.getWithDetails(id, trx, true);
  if (!pedido) {
    throw new AppError('Pedido inexistente', 404, 'NO_ENCONTRADO');
  }
  if (pedido.estado === ESTADOS_PEDIDO.ENTREGADO) {
    return pedido;
  }
  if (pedido.estado === ESTADOS_PEDIDO.CANCELADO) {
    throw new AppError('No se puede entregar un pedido cancelado', 409, 'ESTADO_INVALIDO');
  }

  // Si aún no estaba completado, avanzar y registrar la venta si no existía
  if (pedido.estado !== ESTADOS_PEDIDO.COMPLETADO) {
    if (pedido.estado !== ESTADOS_PEDIDO.EN_EMPAQUE) {
      await pedidoRepository.updateStatus(id, ESTADOS_PEDIDO.EN_EMPAQUE, trx);
    }
    const detalles = Array.isArray(pedido.detalles) ? pedido.detalles : [];
    const ventaExistente = await registroVentaRepository.buscarPorPedidoId(pedido.id, trx);
    if (!ventaExistente) {
      const totalCosto = calcularTotalCosto(detalles);
      await registroVentaRepository.guardar(
        {
          id: crypto.randomUUID(),
          pedido_id: pedido.id,
          fecha: hoy(),
          total_venta: Number(pedido.total || 0),
          total_costo: totalCosto
        },
        trx
      );
    }
    await pedidoRepository.updateStatus(id, ESTADOS_PEDIDO.COMPLETADO, trx);
  }

  await actualizarEstado({ ...pedido, estado: ESTADOS_PEDIDO.COMPLETADO }, ESTADOS_PEDIDO.ENTREGADO, trx);

  if (process.env.CONTINGENCY_ENABLED === 'true') {
    try {
      const { requestContext } = require('../config/db');
      const store = requestContext ? requestContext.getStore() : null;
      if (store?.isOfflineContingency) {
        const { recordOfflineOperation } = require('./operationJournalService');
        const { EffectCollector } = require('./effectCollector');
        const collector = new EffectCollector();
        collector.recordUpdate('pedidos', pedido.id, { estado: ESTADOS_PEDIDO.ENTREGADO }, { estado: pedido.estado });
        await recordOfflineOperation(trx, {
          operationId: `ENT_${pedido.id}_${Date.now()}`,
          actorId: 'cajero_principal',
          operationType: 'ENTREGAR_PEDIDO',
          requestHash: `entregar_${pedido.id}`,
          requestPayload: { id: pedido.id },
          collector,
          result: { id: pedido.id, estado: ESTADOS_PEDIDO.ENTREGADO },
          status: 'pending'
        });
      }
    } catch (e) {
      console.warn('Aviso al registrar entrega en outbox:', e.message);
    }
  }

  return pedidoRepository.getWithDetails(pedido.id, trx);
});

const completar = async (id) => {
  return await dbLocal.transaction(async (trx) => {
    const pedido = await pedidoRepository.getWithDetails(id, trx, true);
    if (!pedido) {
      throw new AppError('Pedido inexistente', 404, 'NO_ENCONTRADO');
    }

    if ([ESTADOS_PEDIDO.COMPLETADO, ESTADOS_PEDIDO.ENTREGADO].includes(pedido.estado)) {
      return { ...pedido, pedido, insumos_descontados: [] };
    }
    if (pedido.estado !== ESTADOS_PEDIDO.EN_EMPAQUE) {
      throw new AppError(`No se puede completar un pedido en estado ${pedido.estado}`, 409, 'TRANSICION_INVALIDA');
    }

    // Las unidades se reservaron al crear; los insumos se consumieron al fabricar.
    const detalles = Array.isArray(pedido.detalles) ? pedido.detalles : [];
    await actualizarEstado(pedido, ESTADOS_PEDIDO.COMPLETADO, trx);

    const ventaExistente = await registroVentaRepository.buscarPorPedidoId(pedido.id, trx);
    if (!ventaExistente) {
      const totalCosto = calcularTotalCosto(detalles);
      await registroVentaRepository.guardar(
        {
          id: crypto.randomUUID(),
          pedido_id: pedido.id,
          fecha: hoy(),
          total_venta: Number(pedido.total || 0),
          total_costo: totalCosto
        },
        trx
      );
    }

    const pedidoActualizado = await pedidoRepository.getWithDetails(pedido.id, trx);

    if (process.env.CONTINGENCY_ENABLED === 'true') {
      try {
        const { requestContext } = require('../config/db');
        const store = requestContext ? requestContext.getStore() : null;
        if (store?.isOfflineContingency) {
          const { recordOfflineOperation } = require('./operationJournalService');
          const { EffectCollector } = require('./effectCollector');
          const collector = new EffectCollector();
          collector.recordUpdate('pedidos', pedido.id, { estado: ESTADOS_PEDIDO.COMPLETADO }, { estado: pedido.estado });
          await recordOfflineOperation(trx, {
            operationId: `CMP_${pedido.id}_${Date.now()}`,
            actorId: 'cajero_principal',
            operationType: 'COMPLETAR_PEDIDO',
            requestHash: `completar_${pedido.id}`,
            requestPayload: { id: pedido.id },
            collector,
            result: { id: pedido.id, estado: ESTADOS_PEDIDO.COMPLETADO },
            status: 'pending'
          });
        }
      } catch (e) {
        console.warn('Aviso al registrar completar en outbox:', e.message);
      }
    }

    return {
      ...pedidoActualizado,
      pedido: pedidoActualizado,
      insumos_descontados: []
    };
  });
};

module.exports = {
  puedeTransicionar,
  obtenerActivas,
  cambiarEstado,
  completar,
  entregar,
  calcularConsumoInsumos,
  detectarFaltantes,
  calcularTotalCosto
};
