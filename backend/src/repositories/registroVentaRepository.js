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
    .where('p.estado', 'completado')
    .whereRaw("strftime('%Y-%m-%d', rv.fecha) = ?", [fecha])
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
    .where('p.estado', 'completado')
    .whereRaw("strftime('%Y-%m-%d', rv.fecha) BETWEEN ? AND ?", [desde, hasta])
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
    .where('p.estado', 'completado')
    .whereRaw("strftime('%Y-%m-%d', p.fecha) BETWEEN ? AND ?", [desde, hasta])
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
    .where('p.estado', 'completado')
    .whereRaw("strftime('%Y-%m-%d', rv.fecha) BETWEEN ? AND ?", [desde, hasta])
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
    .whereRaw("strftime('%Y-%m-%d', fecha) BETWEEN ? AND ?", [desde, hasta])
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
  contarInsumosEnAlerta
};
