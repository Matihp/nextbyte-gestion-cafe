const { dbLocal } = require('../config/db');

const TABLA = 'registro_ventas';

const consulta = (trx) => (trx ? trx(TABLA) : dbLocal(TABLA));

async function guardar(registroVenta, trx = null) {
  await consulta(trx).insert({
    id: registroVenta.id,
    pedido_id: registroVenta.pedidoId || registroVenta.pedido_id,
    fecha: registroVenta.fecha || registroVenta.fechaVenta,
    total_venta: registroVenta.totalVenta ?? registroVenta.total_venta,
    total_costo: registroVenta.totalCosto ?? registroVenta.total_costo
  });

  return buscarPorId(registroVenta.id, trx);
}

async function buscarPorId(id, trx = null) {
  return consulta(trx).where({ id }).first();
}

async function buscarPorPedidoId(pedidoId, trx = null) {
  return consulta(trx).where({ pedido_id: pedidoId }).first();
}

async function listar() {
  return dbLocal(TABLA)
    .select('id', 'pedido_id', 'fecha', 'total_venta', 'total_costo')
    .orderBy('fecha', 'desc');
}

async function obtenerVentasDia(fecha) {
  const resultado = await dbLocal(TABLA + ' as rv')
    .join('pedidos as p', 'rv.pedido_id', 'p.id')
    .whereIn('p.estado', ['completado', 'entregado'])
    .where('rv.fecha', fecha)
    .select(
      dbLocal.raw('COUNT(rv.id) as cantidad_pedidos'),
      dbLocal.raw('SUM(rv.total_venta) as total_venta'),
      dbLocal.raw('SUM(rv.total_costo) as total_costo')
    )
    .first();

  const cantidadPedidos = Number(resultado?.cantidad_pedidos) || 0;
  const totalVenta = Math.round((Number(resultado?.total_venta) || 0) * 100) / 100;
  const totalCosto = Math.round((Number(resultado?.total_costo) || 0) * 100) / 100;

  return {
    fecha,
    cantidad_pedidos: cantidadPedidos,
    total_venta: totalVenta,
    total_costo: totalCosto
  };
}

async function obtenerVentasRango(desde, hasta) {
  const filas = await dbLocal(TABLA + ' as rv')
    .join('pedidos as p', 'rv.pedido_id', 'p.id')
    .whereIn('p.estado', ['completado', 'entregado'])
    .whereBetween('rv.fecha', [desde, hasta])
    .select(
      dbLocal.raw("strftime('%Y-%m-%d', rv.fecha) as fecha"),
      dbLocal.raw('COUNT(rv.id) as cantidad_pedidos'),
      dbLocal.raw('SUM(rv.total_venta) as total_venta'),
      dbLocal.raw('SUM(rv.total_costo) as total_costo')
    )
    .groupBy('rv.fecha')
    .orderBy('rv.fecha', 'asc');

  return filas.map((fila) => ({
    fecha: fila.fecha,
    cantidad_pedidos: Number(fila.cantidad_pedidos) || 0,
    total_venta: Math.round((Number(fila.total_venta) || 0) * 100) / 100,
    total_costo: Math.round((Number(fila.total_costo) || 0) * 100) / 100
  }));
}

async function obtenerTopProductos(desde, hasta, limite = 5) {
  const filas = await dbLocal('detalles_pedidos as dp')
    .join('pedidos as p', 'dp.pedido_id', 'p.id')
    .whereIn('p.estado', ['completado', 'entregado'])
    .whereBetween('p.fecha', [desde, hasta])
    .select(
      'dp.producto_id',
      'dp.nombre_producto',
      dbLocal.raw('SUM(dp.cantidad) as unidades'),
      dbLocal.raw('SUM(dp.cantidad * dp.precio_venta) as ingresos')
    )
    .groupBy('dp.producto_id', 'dp.nombre_producto')
    .orderBy('unidades', 'desc')
    .limit(limite);

  return filas.map((fila) => ({
    producto_id: Number(fila.producto_id),
    nombre_producto: fila.nombre_producto,
    unidades: Number(fila.unidades) || 0,
    ingresos: Math.round((Number(fila.ingresos) || 0) * 100) / 100
  }));
}

async function obtenerTotalesGanancias(desde, hasta) {
  const resultado = await dbLocal(TABLA + ' as rv')
    .join('pedidos as p', 'rv.pedido_id', 'p.id')
    .whereIn('p.estado', ['completado', 'entregado'])
    .whereBetween('rv.fecha', [desde, hasta])
    .select(
      dbLocal.raw('COALESCE(SUM(rv.total_venta), 0) as total_venta'),
      dbLocal.raw('COALESCE(SUM(rv.total_costo), 0) as total_costo')
    )
    .first();

  return {
    total_venta: Math.round((Number(resultado?.total_venta) || 0) * 100) / 100,
    total_costo: Math.round((Number(resultado?.total_costo) || 0) * 100) / 100
  };
}

async function obtenerMermasPorRango(desde, hasta) {
  const filas = await dbLocal('registros_mermas')
    .whereBetween('fecha', [desde, hasta])
    .select(
      'producto_id',
      'nombre_producto',
      'motivo',
      dbLocal.raw('SUM(cantidad) as cantidad_total')
    )
    .groupBy('producto_id', 'nombre_producto', 'motivo')
    .orderBy('nombre_producto', 'asc');

  return filas.map((fila) => ({
    producto_id: fila.producto_id !== null ? Number(fila.producto_id) : null,
    nombre_producto: fila.nombre_producto,
    motivo: fila.motivo,
    cantidad_total: Math.round((Number(fila.cantidad_total) || 0) * 100) / 100
  }));
}

async function contarPedidosActivos() {
  const resultado = await dbLocal('pedidos')
    .whereIn('estado', ['pendiente', 'en_preparacion', 'en_empaque'])
    .count('id as cantidad')
    .first();

  return Number(resultado?.cantidad) || 0;
}

async function contarInsumosEnAlerta() {
  const resultado = await dbLocal('insumos')
    .whereRaw('cantidad_disponible <= stock_minimo')
    .count('id as cantidad')
    .first();

  return Number(resultado?.cantidad) || 0;
}

async function obtenerVentasPorFranjaHoraria() {
  return await dbLocal(TABLA + ' as rv')
    .join('pedidos as p', 'rv.pedido_id', 'p.id')
    .whereIn('p.estado', ['completado', 'entregado'])
    .select(
      dbLocal.raw("strftime('%H:00', p.hora) as hora"),
      'p.tipo_pedido'
    )
    .count('rv.id as cantidadPedidos')
    .groupBy('hora', 'p.tipo_pedido')
    .orderBy('hora', 'asc');
}

async function obtenerVentasPorCategoria() {
  return await dbLocal('detalles_pedidos as dp')
    .join('productos as p', 'dp.producto_id', 'p.id')
    .join('categorias as c', 'p.categoria_id', 'c.id')
    .join('pedidos as pedido', 'dp.pedido_id', 'pedido.id')
    .whereIn('pedido.estado', ['completado', 'entregado'])
    .select('c.nombre as categoria')
    .sum('dp.cantidad as cantidadVendida')
    .groupBy('c.id', 'c.nombre')
    .orderBy('cantidadVendida', 'desc');
}

async function obtenerTransaccionesCaja(filtros = {}) {
  let query = dbLocal('pedidos')
    .whereNot('estado', 'cancelado');

  if (filtros.fecha) {
    query = query.where('fecha', filtros.fecha);
  } else if (filtros.desde && filtros.hasta) {
    query = query.whereBetween('fecha', [filtros.desde, filtros.hasta]);
  } else if (filtros.desde) {
    query = query.where('fecha', '>=', filtros.desde);
  } else if (filtros.hasta) {
    query = query.where('fecha', '<=', filtros.hasta);
  }

  const pedidos = await query
    .orderBy('fecha', 'desc')
    .orderBy('hora', 'asc')
    .orderBy('id', 'asc');

  if (!pedidos || pedidos.length === 0) return [];

  const pedidoIds = pedidos.map((p) => p.id);
  const detalles = await dbLocal('detalles_pedidos')
    .whereIn('pedido_id', pedidoIds);

  const detallesPorPedido = new Map();
  for (const d of detalles) {
    if (!detallesPorPedido.has(d.pedido_id)) {
      detallesPorPedido.set(d.pedido_id, []);
    }
    detallesPorPedido.get(d.pedido_id).push(d);
  }

  const filas = [];
  for (const p of pedidos) {
    const items = detallesPorPedido.get(p.id) || [];
    for (const dp of items) {
      const cant = Number(dp.cantidad) || 0;
      const pCosto = Number(dp.precio_costo) || 0;
      const pVenta = Number(dp.precio_venta) || 0;
      filas.push({
        pedido_id: p.id,
        numero_pedido: p.numero_pedido,
        cliente: p.cliente,
        direccion: p.direccion || null,
        telefono: p.telefono || null,
        fecha: p.fecha,
        hora: p.hora,
        tipo_pedido: p.tipo_pedido,
        metodo_pago: p.metodo_pago,
        estado: p.estado,
        detalle_id: dp.id,
        producto_id: dp.producto_id,
        nombre_producto: dp.nombre_producto,
        cantidad: cant,
        precio_costo: pCosto,
        precio_venta: pVenta,
        costo_total: Math.round(cant * pCosto * 100) / 100,
        venta_total: Math.round(cant * pVenta * 100) / 100
      });
    }
  }

  return filas;
}

module.exports = {
  guardar,
  buscarPorId,
  buscarPorPedidoId,
  listar,
  obtenerVentasDia,
  obtenerVentasRango,
  obtenerTopProductos,
  obtenerTotalesGanancias,
  obtenerMermasPorRango,
  contarPedidosActivos,
  contarInsumosEnAlerta,
  obtenerVentasPorFranjaHoraria,
  obtenerVentasPorCategoria,
  obtenerTransaccionesCaja
};
