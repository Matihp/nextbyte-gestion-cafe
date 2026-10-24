const { dbLocal } = require('../config/db');

const TABLA = 'registro_ventas';
    /**
   * Guarda una nueva venta consolidada
   * Recibe los datos en camelCase desde el Service y los mapea a snake_case para SQLite
   */
  async function guardar(registroVenta) {

    await dbLocal(TABLA).insert({
        id: registroVenta.id,
        pedido_id: registroVenta.pedidoId,
        fecha_venta: registroVenta.fechaVenta,
        total_venta: registroVenta.totalVenta,
        total_costo: registroVenta.totalCosto,
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
        .select('id', 'pedido_id', 'fecha_venta', 'total_venta', 'total_costo')
        .orderBy('fecha_venta', 'desc');
  }

  module.exports = {
    guardar,
    buscarPorId,
    buscarPorPedidoId,
    listar
  };