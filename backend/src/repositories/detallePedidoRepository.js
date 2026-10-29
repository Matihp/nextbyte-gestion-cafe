const crypto = require('crypto');
const { dbLocal } = require('../config/db');

const TABLE = 'detalles_pedidos';

const sanitize = (item) => {
  const cantidad = Number(item.cantidad || 1);
  const precioVenta = Number(item.precio_venta ?? item.precioVenta ?? 0);
  const precioCosto = Number(item.precio_costo ?? item.precioCosto ?? 0);

  return {
    id: item.id || crypto.randomUUID(),
    pedido_id: item.pedido_id || item.pedidoId,
    producto_id: item.producto_id || item.productoId,
    nombre_producto: item.nombre_producto || item.nombreProducto,
    cantidad,
    precio_venta: precioVenta,
    precio_costo: precioCosto
  };
};

module.exports = {
  getByPedidoId: (pedidoId, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb.where({ pedido_id: pedidoId }).orderBy('created_at', 'asc');
  },

  getByProductoId: (productoId, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb.where({ producto_id: productoId }).orderBy('created_at', 'asc');
  },

  getById: (id, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb.where({ id }).first();
  },

  create: async (data, trx = null) => {
    const payload = sanitize(data);
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    await qb.insert(payload);
    return module.exports.getById(payload.id, trx);
  },

  createMany: async (items, trx = null) => {
    if (!items || items.length === 0) return [];
    const payloads = items.map(sanitize);
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    await qb.insert(payloads);
    return payloads;
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

  delete: (id, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb.where({ id }).del();
  },

  deleteByPedidoId: (pedidoId, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb.where({ pedido_id: pedidoId }).del();
  }
};
