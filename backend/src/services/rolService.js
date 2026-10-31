const crypto = require('crypto');
const AppError = require('../utils/AppError');
const rolRepository = require('../repositories/rolRepository');
const empleadoRepository = require('../repositories/empleadoRepository');

const getAll = async () => {
  return rolRepository.getAll();
};

const getById = async (id) => {
  const rol = await rolRepository.getById(id);
  if (!rol) {
    throw new AppError('Rol no encontrado', 404, 'NO_ENCONTRADO');
  }
  return rol;
};

const create = async (datos) => {
  const nombreLimpio = datos.nombre.trim();
  const existente = await rolRepository.getByName(nombreLimpio);
  if (existente) {
    throw new AppError('Ya existe un rol con ese nombre', 409, 'DUPLICADO');
  }

  const payload = {
    id: crypto.randomUUID(),
    nombre: nombreLimpio,
    es_admin: Boolean(datos.es_admin),
    permisos: Array.isArray(datos.permisos) ? datos.permisos : []
  };

  return rolRepository.create(payload);
};

const update = async (id, datos) => {
  const rol = await rolRepository.getById(id);
  if (!rol) {
    throw new AppError('Rol no encontrado', 404, 'NO_ENCONTRADO');
  }

  const payload = {};

  if (datos.nombre !== undefined) {
    const nombreLimpio = datos.nombre.trim();
    const existente = await rolRepository.getByName(nombreLimpio);
    if (existente && existente.id !== id) {
      throw new AppError('Ya existe un rol con ese nombre', 409, 'DUPLICADO');
    }
    payload.nombre = nombreLimpio;
  }

  if (datos.es_admin !== undefined) {
    const nuevoEsAdmin = Boolean(datos.es_admin);
    if (rol.es_admin && !nuevoEsAdmin) {
      const todos = await rolRepository.getAll();
      const admins = todos.filter((r) => r.es_admin);
      if (admins.length <= 1 && admins.some((r) => r.id === id)) {
        throw new AppError('No se puede quitar el rol de administrador al único rol admin', 409, 'ULTIMO_ADMIN');
      }
    }
    payload.es_admin = nuevoEsAdmin;
  }

  if (datos.permisos !== undefined) {
    payload.permisos = Array.isArray(datos.permisos) ? datos.permisos : [];
  }

  return rolRepository.update(id, payload);
};

const remove = async (id) => {
  const rol = await rolRepository.getById(id);
  if (!rol) {
    throw new AppError('Rol no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (rol.es_admin) {
    const todos = await rolRepository.getAll();
    const admins = todos.filter((r) => r.es_admin);
    if (admins.length <= 1) {
      throw new AppError('No se puede eliminar el único rol administrador del sistema', 409, 'ULTIMO_ADMIN');
    }
  }

  const empleados = await empleadoRepository.getByRol(id);
  if (empleados && empleados.length > 0) {
    throw new AppError('No se puede eliminar: el rol tiene empleados asignados', 409, 'RELACION');
  }

  await rolRepository.delete(id);
  return { id };
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove
};
