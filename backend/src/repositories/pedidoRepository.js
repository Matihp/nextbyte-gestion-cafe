const crypto = require('crypto');
const { dbLocal } = require('../config/db');
const detallePedidoRepository = require('./detallePedidoRepository');
const { hoy, ahora } = require('../utils/fechas');

const TABLE = 'pedidos';

const getTodayDate = () => hoy();
const getTodayTime = () => ahora();

const enrichOrder = (order) => {
  if (!order) return null;
  const num = order.numero_pedido || 1;
  const numStr = String(num).padStart(4, '0');
  const displayId = `#${numStr}`;
  return {
    ...order,
    numero_pedido: num,
    display_id: displayId,
    displayId: displayId,
    orderNumber: displayId,
  };
};

module.exports = {
  getUltimoNumeroDelDia: async (fecha, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    return qb
      .where('fecha', fecha)
      .max('numero_pedido as numero_pedido')
      .first();
  },

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
      const rawTerm = String(filters.search).trim();
      const termWithoutHash = rawTerm.replace(/^#/, '');
      const term = `%${termWithoutHash}%`;
      query = query.where((qb) => {
        qb.where('cliente', 'like', term)
          .orWhere('id', 'like', `%${rawTerm}%`)
          .orWhere('telefono', 'like', term)
          .orWhere('numero_pedido', 'like', term);
      });
    }

    const rows = await query.orderBy('created_at', 'desc');
    return rows.map(enrichOrder);
  },

  getById: async (id, trx = null, bloquear = false) => {
    const consulta = () => {
      const qb = (trx || dbLocal)(TABLE);
      return bloquear && trx ? qb.forUpdate() : qb;
    };
    let order = await consulta().where({ id }).first();
    if (!order && String(id).startsWith('#')) {
      const num = parseInt(String(id).replace('#', ''), 10);
      if (!isNaN(num)) {
        order = await consulta()
          .where({ numero_pedido: num })
          .orderBy('created_at', 'desc')
          .first();
      }
    }
    return enrichOrder(order);
  },

  getWithDetails: async (id, trx = null, bloquear = false) => {
    const order = await module.exports.getById(id, trx, bloquear);
    if (!order) return null;

    const details = await detallePedidoRepository.getByPedidoId(order.id, trx);
    return {
      ...order,
      detalles: details
    };
  },

  getByEstado: async (estado) => {
    const rows = await dbLocal(TABLE).where({ estado }).orderBy('created_at', 'asc');
    return rows.map(enrichOrder);
  },

  getByEstados: async (estados, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    const rows = await qb.whereIn('estado', estados).orderBy('created_at', 'asc');
    return rows.map(enrichOrder);
  },

  getActiveComandas: async () => {
    const rows = await dbLocal(TABLE)
      .whereIn('estado', ['pendiente', 'en_preparacion'])
      .orderBy('created_at', 'asc');
    return rows.map(enrichOrder);
  },

  create: async (data, trx = null) => {
    let numero_pedido = data.numero_pedido;
    if (!numero_pedido) {
      const fechaOrder = data.fecha || getTodayDate();
      const ultimo = await module.exports.getUltimoNumeroDelDia(fechaOrder, trx);
      const ultimoNum = Number(ultimo?.numero_pedido || 0);
      numero_pedido = (ultimoNum % 9999) + 1;
    }

    const payload = {
      id: data.id || `PED-${Date.now().toString().slice(-6)}`,
      numero_pedido,
      cliente: data.cliente || 'Consumidor Final',
      total: Number(data.total || 0),
      estado: data.estado || 'pendiente',
      tipo_pedido: data.tipo_pedido || data.tipoPedido || 'salon',
      metodo_pago: data.metodo_pago || data.metodoPago || null,
      direccion: data.direccion || null,
      telefono: data.telefono || null,
      fecha: data.fecha || getTodayDate(),
      hora: data.hora || getTodayTime()
    };

    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    await qb.insert(payload);
    return module.exports.getById(payload.id, trx);
  },

  createWithDetails: async (orderData, items = [], externalTrx = null) => {
    const fn = async (trx) => {
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
    };

    if (externalTrx) {
      return await fn(externalTrx);
    }
    return await dbLocal.transaction(fn);
  },

  update: async (id, data, trx = null) => {
    const qb = trx ? trx(TABLE) : dbLocal(TABLE);
    await qb
      .where({ id })
      .update({
        ...data,
        updated_at: (trx || dbLocal).fn.now()
      });
    return module.exports.getById(id, trx);
  },

  // Devuelve filas afectadas: el llamador debe abortar si perdió el CAS.
  updateIfEstado: (id, estadoEsperado, data, trx) => trx(TABLE)
    .where({ id, estado: estadoEsperado })
    .update({ ...data, updated_at: trx.fn.now() }),

  updateStatus: (id, newStatus, trx = null) => module.exports.update(id, { estado: newStatus }, trx),

  delete: async (id) => {
    return await dbLocal.transaction(async (trx) => {
      await detallePedidoRepository.deleteByPedidoId(id, trx);
      return await trx(TABLE).where({ id }).del();
    });
  }
};
