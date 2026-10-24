const { dbLocal } = require("../config/db");

const TABLA = "proveedores";

const obtenerTodos = async () => {
  return await dbLocal(TABLA)
    .select("*")
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
  await dbLocal(TABLA).insert({
    id: proveedor.id,
    codigo: proveedor.codigo,
    empresa: proveedor.empresa,
    nombre_contacto: proveedor.nombreContacto,
    apellido_contacto: proveedor.apellidoContacto,
    telefono: proveedor.telefono,
    email: proveedor.email,
    rubro: proveedor.rubro,
    insumos_asignados_ids: JSON.stringify(
      proveedor.insumosAsignadosIds || []
    ),
  });

  return await obtenerPorId(proveedor.id);
};

const actualizar = async (id, proveedor) => {
  await dbLocal(TABLA)
    .where({ id })
    .update({
      codigo: proveedor.codigo,
      empresa: proveedor.empresa,
      nombre_contacto: proveedor.nombreContacto,
      apellido_contacto: proveedor.apellidoContacto,
      telefono: proveedor.telefono,
      email: proveedor.email,
      rubro: proveedor.rubro,
      insumos_asignados_ids: JSON.stringify(
        proveedor.insumosAsignadosIds || []
      ),
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
  obtenerPorCodigo,
  crear,
  actualizar,
  eliminar,
};
