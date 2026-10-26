const { dbLocal } = require("../config/db");

const TABLA = "proveedores";

const deserializar = (fila) => {
  if (!fila) return fila;
  return {
    ...fila,
    insumos_asignados_ids: fila.insumos_asignados_ids
      ? JSON.parse(fila.insumos_asignados_ids)
      : [],
  };
};

const obtenerTodos = async () => {
  const filas = await dbLocal(TABLA)
    .select("*")
    .orderBy("empresa", "asc");

  return filas.map(deserializar);
};

const obtenerPorId = async (id) => {
  const fila = await dbLocal(TABLA)
    .where({ id })
    .first();

  return deserializar(fila);
};

const obtenerPorCodigo = async (codigo) => {
  const fila = await dbLocal(TABLA)
    .where({ codigo })
    .first();

  return deserializar(fila);
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

