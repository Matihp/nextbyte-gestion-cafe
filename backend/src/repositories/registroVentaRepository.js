const { dbLocal } = require('../config/db');

const TABLA = 'registro_ventas';

const consulta = (trx) => (trx ? trx(TABLA) : dbLocal(TABLA));
/**
* Guarda una nueva venta consolidada
* Recibe los datos en camelCase desde el Service y los mapea a snake_case para SQLite
*/
async function guardar(registroVenta, trx = null) {

  await consulta(trx).insert({
    id: registroVenta.id,
    pedido_id: registroVenta.pedidoId || registroVenta.pedido_id,
    fecha: registroVenta.fecha || registroVenta.fechaVenta,
    total_venta: registroVenta.totalVenta ?? registroVenta.total_venta,
    total_costo: registroVenta.totalCosto ?? registroVenta.total_costo,
  });

  return buscarPorId(registroVenta.id, trx)
}

/**
 * Obtiene una venta por su ID
 */
async function buscarPorId(id, trx = null) {
  return consulta(trx).where({ id }).first();
}

/**
 * Obtiene todas las ventas (Útil para hacer pruebas rápido)
 */
async function buscarPorPedidoId(pedidoId, trx = null) {
  return consulta(trx).where({ pedido_id: pedidoId }).first();
}

/**
 * Obtiene todas las ventas (Útil para hacer pruebas rápido)
 */
async function listar() {
  return dbLocal(TABLA)
    .select('id', 'pedido_id', 'fecha', 'total_venta', 'total_costo')
    .orderBy('fecha', 'desc');
}

// ==========================================
// CONSULTAS AVANZADAS PARA EL DASHBOARD 
// ==========================================

/**
 * 1. KPIs Generales (Tarjetas de Home /dashboard)
 * Calcula ingresos, costos, ganancia, ticket promedio y cantidad de ventas.
 */
async function obtenerResumenGeneral() {
  const resultado = await dbLocal(TABLA)
    .sum('total_venta as ingresosTotales')
    .sum('total_costo as costosTotales')
    .count('id as cantidadVentas')
    .avg('total_venta as ticketPromedio')
    .first();

  const ingresos = Number(resultado.ingresosTotales) || 0;
  const costos = Number(resultado.costosTotales) || 0;

  return {
    ingresosTotales: ingresos,
    costosTotales: costos,
    rentabilidad: ingresos - costos,
    cantidadVentas: Number(resultado.cantidadVentas) || 0,
    ticketPromedio: Number(resultado.ticketPromedio) || 0
  };
}

/**
 * 2. Tendencias de Ventas (Gráfico de líneas de /analytics)
 * Agrupa las ventas por día para ver la evolución.
 */
async function obtenerVentasPorDia() {
  return await dbLocal(TABLA)
    .select(dbLocal.raw("strftime('%Y-%m-%d', fecha) as dia"))
    .sum('total_venta as totalDia')
    .count('id as cantidadPedidos')
    .groupBy('dia')
    .orderBy('dia', 'asc');
}

/**
 * 3. Top Productos Más Vendidos (Gráfico de barras de /analytics)
 * Hacemos JOIN con la tabla 'detalles_pedidos' (Matías) y 'productos' (Carlos).
 */
async function obtenerProductosMasVendidos(limite = 5) {
  return await dbLocal('detalles_pedidos as dp')
    .join('productos as p', 'dp.producto_id', 'p.id')
    .select('p.nombre as producto')
    .sum('dp.cantidad as cantidadVendida')
    .groupBy('p.id', 'p.nombre')
    .orderBy('cantidadVendida', 'desc')
    .limit(limite);
}

/**
 * 4. Histórico de Mermas (Listado para /analytics)
 * Lee de 'registros_mermas' (Lucas) para ver las pérdidas.
 */
async function obtenerHistorialMermas() {
  return await dbLocal('registros_mermas')
    .select('id', 'nombre_producto', 'nombre_categoria', 'motivo', 'fecha', 'cantidad')
    .orderBy('fecha', 'desc');
}

/**
 * 5. Picos de Ventas por Franja Horaria (Gráfico de líneas)
 * Hacemos JOIN con la tabla 'pedidos' para saber el tipo (Mostrador, Delivery, etc.)
 * y extraemos la hora de la fecha de venta.
 */
async function obtenerVentasPorFranjaHoraria() {
  return await dbLocal(TABLA + ' as rv')
    .join('pedidos as p', 'rv.pedido_id', 'p.id')
    .select(dbLocal.raw("strftime('%H:00', rv.fecha) as hora"),
      'p.tipo_pedido'
    )
    .count('rv.id as cantidadPedidos')
    .groupBy('hora', 'p.tipo_pedido')
    .orderBy('hora', 'asc');
}

/**
 * 6. Ventas por Categoría (Gráfico de torta)
 * JOIN entre detalles_pedidos -> productos -> categorias
 */
async function obtenerVentasPorCategoria() {
  return await dbLocal('detalles_pedidos as dp')
    .join('productos as p', 'dp.producto_id', 'p.id')
    .join('categorias as c', 'p.categoria_id', 'c.id')
    .select('c.nombre as categoria')
    .sum('dp.cantidad as cantidadVendida')
    .groupBy('c.id', 'c.nombre')
    .orderBy('cantidadVendida', 'desc');
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
    .groupBy('fecha')
    .orderBy('fecha', 'asc');

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
  obtenerResumenGeneral,
  obtenerVentasPorDia,
  obtenerProductosMasVendidos,
  obtenerHistorialMermas,
  obtenerVentasPorFranjaHoraria,
  obtenerVentasPorCategoria,
  obtenerVentasDia,
  obtenerVentasRango,
  obtenerTopProductos,
  obtenerTotalesGanancias,
  obtenerMermasPorRango,
  contarPedidosActivos,
  contarInsumosEnAlerta
};