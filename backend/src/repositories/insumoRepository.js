const { dbLocal } = require("../config/db");

const TABLE = "insumos";

module.exports = {
  getAll: () => dbLocal(TABLE).select("*").orderBy("nombre", "asc"),

  getById: (id) => dbLocal(TABLE).where({ id }).first(),

  create: async (data) => {
    const [id] = await dbLocal(TABLE).insert({
      nombre: data.nombre,
      rubro: data.rubro,
      cantidad_disponible: data.cantidad_disponible,
      unidad_medida: data.unidad_medida,
      stock_minimo: data.stock_minimo,
      precio_costo: data.precio_costo,
      ultima_actualizacion: data.ultima_actualizacion,
      fecha_ingreso: data.fecha_ingreso,
      fecha_vencimiento: data.fecha_vencimiento,
    });

    return module.exports.getById(id);
  },

  update: async (id, data) => {
    const payload = {
      nombre: data.nombre,
      rubro: data.rubro,
      cantidad_disponible: data.cantidad_disponible,
      unidad_medida: data.unidad_medida,
      stock_minimo: data.stock_minimo,
      precio_costo: data.precio_costo,
      ultima_actualizacion: data.ultima_actualizacion,
      fecha_ingreso: data.fecha_ingreso,
      fecha_vencimiento: data.fecha_vencimiento,
    };

    await dbLocal(TABLE).where({ id }).update(payload);

    return module.exports.getById(id);
  },

  delete: (id) => dbLocal(TABLE).where({ id }).del(),
};
