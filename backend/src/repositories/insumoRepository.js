const { dbLocal } = require("../config/db");

const TABLA = "insumos";

const obtenerTodos = async () => {
  return await dbLocal(TABLA)
    .select("*")
    .orderBy("nombre", "asc");
};

const obtenerPorId = async (id) => {
  return await dbLocal(TABLA)
    .where({ id })
    .first();
};

const crear = async (insumo) => {
  await dbLocal(TABLA).insert({
    id: insumo.id,
    nombre: insumo.nombre,
    rubro: insumo.rubro,
    cantidad_disponible: insumo.cantidad_disponible,
    unidad_medida: insumo.unidad_medida,
    stock_minimo: insumo.stock_minimo,
    precio_costo: insumo.precio_costo,
    ultima_actualizacion: insumo.ultima_actualizacion,
    fecha_ingreso: insumo.fecha_ingreso,
    fecha_vencimiento: insumo.fecha_vencimiento,
  });

  return await obtenerPorId(insumo.id);
};

const actualizar = async (id, insumo) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      nombre: insumo.nombre,
      rubro: insumo.rubro,
      cantidad_disponible: insumo.cantidad_disponible,
      unidad_medida: insumo.unidad_medida,
      stock_minimo: insumo.stock_minimo,
      precio_costo: insumo.precio_costo,
      ultima_actualizacion: insumo.ultima_actualizacion,
      fecha_ingreso: insumo.fecha_ingreso,
      fecha_vencimiento: insumo.fecha_vencimiento,
    });

  return await obtenerPorId(id);
};

const eliminar = async (id) => {
  return await dbLocal(TABLA)
    .where({ id })
    .del();
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};
