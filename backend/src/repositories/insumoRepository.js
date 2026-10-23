const { dbLocal } = require("../config/db");

const TABLA = "insumos";

const CAMPOS = [
  "id",
  "nombre",
  "categoria",
  "unidad",
  "stock_minimo as stockMinimo",
  "activo",
  "created_at",
  "updated_at",
];

const obtenerTodos = async () => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .orderBy("nombre", "asc");
};

const obtenerActivos = async () => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .where("activo", true)
    .orderBy("nombre", "asc");
};

const obtenerPorId = async (id) => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .where({ id })
    .first();
};

const crear = async (insumo, conexion = dbLocal) => {
  const [id] = await conexion(TABLA).insert({
    nombre: insumo.nombre,
    categoria: insumo.categoria,
    unidad: insumo.unidad,
    stock_minimo: insumo.stockMinimo,
    activo: true,
  });

  return await conexion(TABLA)
    .select(...CAMPOS)
    .where({ id })
    .first();
};

const actualizar = async (id, insumo) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      unidad: insumo.unidad,
      stock_minimo: insumo.stockMinimo,
      updated_at: dbLocal.fn.now(),
    });

  return await obtenerPorId(id);
};

const cambiarEstado = async (id, activo) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      activo,
      updated_at: dbLocal.fn.now(),
    });

  return await obtenerPorId(id);
};

const eliminar = async (id) => {
  return await dbLocal(TABLA)
    .where({ id })
    .del();
};

const tieneLotes = async (id) => {
  const resultado = await dbLocal("lotes")
    .where("insumo_id", id)
    .count({ cantidad: "*" })
    .first();

  return Number(resultado.cantidad) > 0;
};

const tieneMovimientos = async (id) => {
  const resultado = await dbLocal("movimientos_inventario")
    .where("insumo_id", id)
    .count({ cantidad: "*" })
    .first();

  return Number(resultado.cantidad) > 0;
};

module.exports = {
  obtenerTodos,
  obtenerActivos,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  tieneLotes,
  tieneMovimientos,
};

