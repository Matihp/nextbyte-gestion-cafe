const crypto = require("crypto");
const { dbLocal } = require("../config/db");

const TABLE = "registros_mermas";

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getAll: (filtros = {}, trx = null) => {
    const query = consulta(trx).select("*");

    if (filtros.desde) query.where("fecha", ">=", filtros.desde);
    if (filtros.hasta) query.where("fecha", "<=", filtros.hasta);
    if (filtros.producto_id) query.where({ producto_id: filtros.producto_id });

    return query.orderBy("fecha", "desc");
  },

  getById: (id, trx = null) => consulta(trx).where({ id }).first(),

  getByProductoId: (productoId) =>
    dbLocal(TABLE).where({ producto_id: productoId }).orderBy("fecha", "desc"),

  getByFecha: (fecha) =>
    dbLocal(TABLE).where({ fecha }).orderBy("created_at", "desc"),

  create: async (data, trx = null) => {
    const payload = {
      id: data.id || crypto.randomUUID(),
      producto_id: data.producto_id || data.productoId || null,
      nombre_producto: data.nombre_producto || data.nombreProducto || null,
      nombre_categoria: data.nombre_categoria || data.nombreCategoria || null,
      motivo: data.motivo,
      fecha: data.fecha || new Date().toISOString().split("T")[0],
      cantidad: data.cantidad !== undefined ? Number(data.cantidad) : 1,
    };

    await consulta(trx).insert(payload);
    return module.exports.getById(payload.id, trx);
  },

  update: async (id, data) => {
    const payload = { ...data };
    if (payload.productoId !== undefined) payload.producto_id = payload.productoId;
    if (payload.nombreProducto !== undefined) payload.nombre_producto = payload.nombreProducto;
    if (payload.nombreCategoria !== undefined) payload.nombre_categoria = payload.nombreCategoria;

    delete payload.productoId;
    delete payload.nombreProducto;
    delete payload.nombreCategoria;

    await dbLocal(TABLE)
      .where({ id })
      .update({
        ...payload,
        updated_at: dbLocal.fn.now(),
      });

    return module.exports.getById(id);
  },

  delete: (id, trx = null) => consulta(trx).where({ id }).del(),
};
