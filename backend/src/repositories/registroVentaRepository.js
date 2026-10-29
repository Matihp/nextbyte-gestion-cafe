const { dbLocal } = require('../config/db');

const TABLA = 'registro_ventas';
    /**
   * Guarda una nueva venta consolidada
   * Recibe los datos en camelCase desde el Service y los mapea a snake_case para SQLite
   */
  async function guardar(registroVenta) {

    await dbLocal(TABLA).insert({
        id: registroVenta.id,
        pedido_id: registroVenta.pedidoId || registroVenta.pedido_id,
        fecha: registroVenta.fecha || registroVenta.fechaVenta,
        total_venta: registroVenta.totalVenta ?? registroVenta.total_venta,
        total_costo: registroVenta.totalCosto ?? registroVenta.total_costo,
    });

    return buscarPorId(registroVenta.id)
  }

  /**
   * Obtiene una venta por su ID
   */
  async function buscarPorId(id) {
    return dbLocal(TABLA).where({ id }).first();
  }

  /**
   * Obtiene todas las ventas (Útil para hacer pruebas rápido)
   */
  async function buscarPorPedidoId(pedidoId) {
    return dbLocal(TABLA).where({ pedido_id: pedidoId }).first();
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
      ticketPromedio: Number(resultado.TicketPromedio) || 0
    };
}

/**
 * 2. Tendencias de Ventas (Gráfico de líneas de /analytics)
 * Agrupa las ventas por día para ver la evolución.
 */
async function obtenerVentasPorDia() {
  return await dbLocal(TABLA)
    .select(dbLocal.raw("strftime('%Y-%m-%d', fecha_venta) as dia"))
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
    .orderBy('cantidadVendida', 'asc')
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
    .select(dbLocal.raw("strftime('%H:00', rv.fecha_venta) as hora"),
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
    obtenerVentasPorCategoria
  };