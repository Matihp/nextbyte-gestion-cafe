const crypto = require('crypto');
const { ESTADOS_PEDIDO, ESTADOS_ACTIVOS } = require('../utils/constantes');
const { hoy } = require('../utils/fechas');
const AppError = require('../utils/AppError');
const { dbLocal } = require('../config/db');
const pedidoRepository = require('../repositories/pedidoRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');
const recetaRepository = require('../repositories/recetaRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const insumoRepository = require('../repositories/insumoRepository');
const productoRepository = require('../repositories/productoRepository');
const registroVentaRepository = require('../repositories/registroVentaRepository');

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS_PEDIDO.PENDIENTE]: [ESTADOS_PEDIDO.EN_PREPARACION],
  [ESTADOS_PEDIDO.EN_PREPARACION]: [ESTADOS_PEDIDO.EN_EMPAQUE]
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

const obtenerActivas = async () => {
  const pedidos = await pedidoRepository.getByEstados(ESTADOS_ACTIVOS);
  const pedidosConDetalles = await Promise.all(
    pedidos.map(async (pedido) => {
      const detalles = await detallePedidoRepository.getByPedidoId(pedido.id);
      return {
        ...pedido,
        detalles
      };
    })
  );
  return pedidosConDetalles;
};

const cambiarEstado = async (id, nuevoEstado) => {
  const todosLosEstados = Object.values(ESTADOS_PEDIDO);
  if (!nuevoEstado || typeof nuevoEstado !== 'string' || !todosLosEstados.includes(nuevoEstado)) {
    throw new AppError('El estado proporcionado no es válido', 400, 'VALIDACION');
  }

  const pedido = await pedidoRepository.getById(id);
  if (!pedido) {
    throw new AppError('Pedido inexistente', 404, 'NO_ENCONTRADO');
  }

  if (!puedeTransicionar(pedido.estado, nuevoEstado)) {
    throw new AppError(`No se puede pasar de ${pedido.estado} a ${nuevoEstado}`, 409, 'TRANSICION_INVALIDA');
  }

  await pedidoRepository.updateStatus(id, nuevoEstado);
  return await pedidoRepository.getWithDetails(id);
};

const completar = async (id) => {
  return await dbLocal.transaction(async (trx) => {
    const pedido = await pedidoRepository.getWithDetails(id, trx);
    if (!pedido) {
      throw new AppError('Pedido inexistente', 404, 'NO_ENCONTRADO');
    }

    if (pedido.estado !== ESTADOS_PEDIDO.EN_EMPAQUE) {
      throw new AppError(`No se puede completar un pedido en estado ${pedido.estado}`, 409, 'TRANSICION_INVALIDA');
    }

    const detalles = Array.isArray(pedido.detalles) ? pedido.detalles : [];
    const recetasPorProducto = new Map();
    const productosSinReceta = new Map();

    for (const detalle of detalles) {
      const productoId = detalle.producto_id;
      if (!recetasPorProducto.has(productoId)) {
        const receta = await recetaRepository.getByProductoId(productoId, trx);
        if (receta) {
          const ingredientes = await ingredienteRecetaRepository.getByRecetaId(receta.id, trx);
          recetasPorProducto.set(productoId, ingredientes);
        } else {
          recetasPorProducto.set(productoId, null);
        }
      }

      if (!recetasPorProducto.get(productoId)) {
        const cantActual = productosSinReceta.get(productoId) || 0;
        productosSinReceta.set(productoId, cantActual + Number(detalle.cantidad || 0));
      }
    }

    const consumoInsumos = calcularConsumoInsumos(detalles, recetasPorProducto);

    const stockPorInsumo = new Map();
    const entidadesInsumos = new Map();
    for (const [insumoId] of consumoInsumos) {
      const insumo = await insumoRepository.getById(insumoId, trx);
      if (insumo) {
        stockPorInsumo.set(Number(insumoId), {
          cantidad_disponible: Number(insumo.cantidad_disponible || 0),
          nombre: insumo.nombre
        });
        entidadesInsumos.set(Number(insumoId), insumo);
      } else {
        stockPorInsumo.set(Number(insumoId), {
          cantidad_disponible: 0,
          nombre: `Insumo ${insumoId}`
        });
      }
    }

    const faltantes = detectarFaltantes(consumoInsumos, stockPorInsumo);
    if (faltantes.length > 0) {
      const primerFaltante = faltantes[0];
      throw new AppError(`Stock insuficiente de ${primerFaltante.nombre}`, 409, 'STOCK_INSUFICIENTE');
    }

    for (const [productoId, cantRequerida] of productosSinReceta) {
      const prod = await productoRepository.getById(productoId, trx);
      if (!prod || Number(prod.stock_actual || 0) < cantRequerida) {
        throw new AppError(`Stock insuficiente de ${prod ? prod.nombre : 'producto'}`, 409, 'STOCK_INSUFICIENTE');
      }
    }

    const insumosDescontados = [];
    for (const [insumoId, cantidad] of consumoInsumos) {
      await insumoRepository.descontarStock(insumoId, cantidad, trx);
      const insumo = entidadesInsumos.get(Number(insumoId));
      insumosDescontados.push({
        insumo_id: Number(insumoId),
        nombre: insumo ? insumo.nombre : `Insumo ${insumoId}`,
        cantidad: Number(cantidad)
      });
    }

    for (const [productoId, cantidad] of productosSinReceta) {
      await productoRepository.updateStock(productoId, -Number(cantidad), trx);
    }

    await pedidoRepository.updateStatus(id, ESTADOS_PEDIDO.COMPLETADO, trx);

    const ventaExistente = await registroVentaRepository.buscarPorPedidoId(id, trx);
    if (!ventaExistente) {
      const totalCosto = calcularTotalCosto(detalles);
      await registroVentaRepository.guardar(
        {
          id: crypto.randomUUID(),
          pedido_id: id,
          fecha: hoy(),
          total_venta: Number(pedido.total || 0),
          total_costo: totalCosto
        },
        trx
      );
    }

    const pedidoActualizado = await pedidoRepository.getWithDetails(id, trx);
    return {
      ...pedidoActualizado,
      pedido: pedidoActualizado,
      insumos_descontados: insumosDescontados
    };
  });
};

module.exports = {
  puedeTransicionar,
  obtenerActivas,
  cambiarEstado,
  completar,
  calcularConsumoInsumos,
  detectarFaltantes,
  calcularTotalCosto
};
