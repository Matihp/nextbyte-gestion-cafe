const { dbLocal } = require("../config/db");

const TABLA = "proveedores";

const obtenerTodos = async () => {
  return await dbLocal(TABLA)
    .select("*")
    .orderBy("empresa", "asc");
};

const obtenerActivos = async () => {
  return await dbLocal(TABLA)
    .select("*")
    .where("activo", true)
    .orderBy("empresa", "asc");
};

const obtenerPorId = async (id) => {
  return await dbLocal(TABLA)
    .where({ id })
    .first();
};

const obtenerPorCodigo = async (codigo) => {
  return await dbLocal(TABLA)
    .where({ codigo })
    .first();
};

const crear = async (proveedor) => {
  const [id] = await dbLocal(TABLA).insert({
    codigo: proveedor.codigo,
    empresa: proveedor.empresa,
    contacto: proveedor.contacto,
    rubro: proveedor.rubro,
    email: proveedor.email,
    telefono: proveedor.telefono,
    activo: true,
  });

  return await obtenerPorId(id);
};

const actualizar = async (id, proveedor) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      empresa: proveedor.empresa,
      contacto: proveedor.contacto,
      rubro: proveedor.rubro,
      email: proveedor.email,
      telefono: proveedor.telefono,
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

module.exports = {
  obtenerTodos,
  obtenerActivos,
  obtenerPorId,
  obtenerPorCodigo,
  crear,
  actualizar,
  cambiarEstado,
};
