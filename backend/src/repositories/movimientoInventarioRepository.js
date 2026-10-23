const { dbLocal } = require("../config/db");

const TABLA = "movimientos_inventario";

const CAMPOS = [
  "id",
  "insumo_id as insumoId",
  "lote_id as loteId",
  "tipo",
  "cantidad",
  "motivo",
  "fecha",
  "created_at",
];

const obtenerTodos = async () => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .orderBy("fecha", "desc");
};

const obtenerPorInsumo = async (insumoId) => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .where("insumo_id", insumoId)
    .orderBy("fecha", "desc");
};

const obtenerPorLote = async (loteId) => {
  return await dbLocal(TABLA)
    .select(...CAMPOS)
    .where("lote_id", loteId)
    .orderBy("fecha", "desc");
};

const crear = async (movimiento, conexion = dbLocal) => {
  const [id] = await conexion(TABLA).insert({
    insumo_id: movimiento.insumoId,
    lote_id: movimiento.loteId || null,
    tipo: movimiento.tipo,
    cantidad: movimiento.cantidad,
    motivo: movimiento.motivo || null,
  });

  return await conexion(TABLA)
    .select(...CAMPOS)
    .where({ id })
    .first();
};

const ejecutarEnTransaccion = async (operacion) => {
  return await dbLocal.transaction(async (trx) => {
    return await operacion(trx);
  });
};

module.exports = {
  obtenerTodos,
  obtenerPorInsumo,
  obtenerPorLote,
  crear,
  ejecutarEnTransaccion,
};

