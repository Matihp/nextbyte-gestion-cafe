const { dbLocal } = require("../config/db");

const { hoy, ahora } = require("../utils/fechas");

const TABLE = "insumos";

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

const ajustarStock = async (id, variacion, trx) => {
  await consulta(trx)
    .where({ id })
    .update({
      cantidad_disponible: dbLocal.raw("cantidad_disponible + ?", [variacion]),
      ultima_actualizacion: `${hoy()} ${ahora()}`,
    });

  return module.exports.getById(id, trx);
};

module.exports = {
  getAll: () => dbLocal(TABLE).select("*").orderBy("nombre", "asc"),

  getById: (id, trx = null) => consulta(trx).where({ id }).first(),

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

  update: async (id, data, trx = null) => {
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

    await consulta(trx).where({ id }).update(payload);

    return module.exports.getById(id, trx);
  },

  delete: (id, trx = null) => consulta(trx).where({ id }).del(),

  descontarStock: (id, cantidad, trx = null) => ajustarStock(id, -Number(cantidad), trx),

  ingresarStock: (id, cantidad, trx = null) => ajustarStock(id, Number(cantidad), trx),
};
