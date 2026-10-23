const { dbLocal } = require("../config/db");

const TABLA = "lotes";

const CAMPOS = [
  "id",
  "insumo_id as insumoId",
  "proveedor_id as proveedorId",
  "cantidad",
  "costo_unitario as costoUnitario",
  "fecha_ingreso as fechaIngreso",
  "fecha_vencimiento as fechaVencimiento",
  "estado",
  "created_at",
  "updated_at",
];

const obtenerTodos = async () => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .orderBy("fecha_ingreso", "desc");
};

const obtenerPorId = async (id, conexion = dbLocal) => {
  return await conexion(TABLA)
    .select(...CAMPOS)
    .where({ id })
    .first();
};

const obtenerPorInsumo = async (insumoId) => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .where("insumo_id", insumoId)
    .orderBy("fecha_ingreso", "desc");
};

const crear = async (lote, conexion = dbLocal) => {
  const [id] = await conexion(TABLA).insert({
    insumo_id: lote.insumoId,
    proveedor_id: lote.proveedorId,
    cantidad: lote.cantidad,
    costo_unitario: lote.costoUnitario,
    fecha_ingreso: lote.fechaIngreso,
    fecha_vencimiento: lote.fechaVencimiento || null,
    estado: "activo",
  });

  return await obtenerPorId(id, conexion);
};

const actualizar = async (id, lote) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      proveedor_id: lote.proveedorId,
      cantidad: lote.cantidad,
      costo_unitario: lote.costoUnitario,
      fecha_ingreso: lote.fechaIngreso,
      fecha_vencimiento: lote.fechaVencimiento || null,
      updated_at: dbLocal.fn.now(),
    });

  return await obtenerPorId(id);
};

const actualizarCantidad = async (
  id,
  cantidad,
  conexion = dbLocal
) => {
  await conexion(TABLA)
    .where({ id })
    .update({
      cantidad,
      updated_at: conexion.fn.now(),
    });

  return await obtenerPorId(id, conexion);
};

const cambiarEstado = async (id, estado) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      estado,
      updated_at: dbLocal.fn.now(),
    });

  return await obtenerPorId(id);
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  obtenerPorInsumo,
  crear,
  actualizar,
  actualizarCantidad,
  cambiarEstado,
};

