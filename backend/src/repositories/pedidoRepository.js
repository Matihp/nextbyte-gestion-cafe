const crypto = require('crypto');
const { dbLocal } = require('../config/db');
const detallePedidoRepository = require('./detallePedidoRepository');

const TABLE = 'pedidos';

const getTodayDate = () => new Date().toISOString().split('T')[0];
const getTodayTime = () => new Date().toTimeString().split(' ')[0];

module.exports = {
  getAll: async (filters = {}) => {
    let query = dbLocal(TABLE).select('*');

    if (filters.estado) {
      query = query.where('estado', filters.estado);
    }
    if (filters.tipo_pedido || filters.tipoPedido) {
      query = query.where('tipo_pedido', filters.tipo_pedido || filters.tipoPedido);
    }
    if (filters.metodo_pago || filters.metodoPago) {
      query = query.where('metodo_pago', filters.metodo_pago || filters.metodoPago);
    }
    if (filters.empleado_id || filters.empleadoId) {
      query = query.where('empleado_id', filters.empleado_id || filters.empleadoId);
    }
    if (filters.fecha) {
      query = query.where('fecha', filters.fecha);
    }
    if (filters.desde) {
      query = query.where('fecha', '>=', filters.desde);
    }
    if (filters.hasta) {
      query = query.where('fecha', '<=', filters.hasta);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.where((qb) => {
        qb.where('cliente', 'like', term)
          .orWhere('id', 'like', term)
          .orWhere('mesa', 'like', term)
          .orWhere('telefono', 'like', term);
      });
    }

    return await query.orderBy('created_at', 'desc');
  },

  getById: (id, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb.where({ id }).first();
  },

  getWithDetails: async (id, trx = null) => {
    const order = await module.exports.getById(id, trx);
    if (!order) return null;

    const details = await detallePedidoRepository.getByPedidoId(id, trx);
    return {
      ...order,
      detalles: details
    };
  },

  getByEstado: (estado) => dbLocal(TABLE).where({ estado }).orderBy('created_at', 'asc'),

  getActiveComandas: () =>
    dbLocal(TABLE)
      .whereIn('estado', ['pendiente', 'en_preparacion'])
      .orderBy('created_at', 'asc'),

  create: async (data, trx = null) => {
    const payload = {
      id: data.id || `PED-${Date.now().toString().slice(-6)}`,
      cliente: data.cliente || 'Consumidor Final',
      total: Number(data.total || 0),
      estado: data.estado || 'pendiente',
      tipo_pedido: data.tipo_pedido || data.tipoPedido || 'salon',
      metodo_pago: data.metodo_pago || data.metodoPago || null,
      direccion: data.direccion || null,
      telefono: data.telefono || null,
      fecha: data.fecha || getTodayDate(),
      hora: data.hora || getTodayTime(),
      empleado_id: data.empleado_id || data.empleadoId || null,
      mesa: data.mesa || null,
      notas: data.notas || null
    };

    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    await qb.insert(payload);
    return module.exports.getById(payload.id, trx);
  },

  createWithDetails: async (orderData, items = []) => {
    return await dbLocal.transaction(async (trx) => {
      let computedTotal = Number(orderData.total || 0);
      if (!computedTotal && items.length > 0) {
        computedTotal = items.reduce((acc, item) => {
          const cant = Number(item.cantidad || 1);
          const price = Number(item.precio_venta ?? item.precioVenta ?? 0);
          return acc + cant * price;
        }, 0);
      }

      const orderHeader = await module.exports.create(
        {
          ...orderData,
          total: Number(computedTotal.toFixed(2))
        },
        trx
      );

      if (items.length > 0) {
        const itemsWithOrderId = items.map((item) => ({
          ...item,
          pedido_id: orderHeader.id
        }));
        await detallePedidoRepository.createMany(itemsWithOrderId, trx);
      }

      return await module.exports.getWithDetails(orderHeader.id, trx);
    });
  },

  update: async (id, data, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    await qb
      .where({ id })
      .update({
        ...data,
        updated_at: dbLocal.fn.now()
      });
    return module.exports.getById(id, trx);
  },

  updateStatus: (id, newStatus) => module.exports.update(id, { estado: newStatus }),

  delete: async (id) => {
    return await dbLocal.transaction(async (trx) => {
      await detallePedidoRepository.deleteByPedidoId(id, trx);
      return await trx(TABLE).where({ id }).del();
    });
  }
};
