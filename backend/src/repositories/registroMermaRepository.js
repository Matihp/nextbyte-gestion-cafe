const crypto = require("crypto");
const { dbLocal } = require("../config/db");

const TABLE = "registros_mermas";

module.exports = {
  getAll: () => dbLocal(TABLE).select("*").orderBy("fecha", "desc"),

  getById: (id) => dbLocal(TABLE).where({ id }).first(),

  getByProductoId: (productoId) =>
    dbLocal(TABLE).where({ producto_id: productoId }).orderBy("fecha", "desc"),

  getByFecha: (fecha) =>
    dbLocal(TABLE).where({ fecha }).orderBy("created_at", "desc"),

  create: async (data) => {
    const payload = {
      id: data.id || crypto.randomUUID(),
      producto_id: data.producto_id || data.productoId || null,
      nombre_producto: data.nombre_producto || data.nombreProducto || null,
      nombre_categoria: data.nombre_categoria || data.nombreCategoria || null,
      motivo: data.motivo,
      fecha: data.fecha || new Date().toISOString().split("T")[0],
      cantidad: data.cantidad !== undefined ? Number(data.cantidad) : 1,
    };

    await dbLocal(TABLE).insert(payload);
    return module.exports.getById(payload.id);
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

  delete: (id) => dbLocal(TABLE).where({ id }).del(),
};
