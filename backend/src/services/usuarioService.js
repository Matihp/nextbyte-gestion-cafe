const AppError = require('../utils/AppError');
const empleadoRepository = require('../repositories/empleadoRepository');
const rolRepository = require('../repositories/rolRepository');

const quitarContrasena = (empleado) => {
  if (!empleado) return empleado;
  const { contrasena, ...resto } = empleado;
  return resto;
};

const cambiarRol = async (empleadoId, rolId) => {
  const empleado = await empleadoRepository.getById(empleadoId);
  if (!empleado) {
    throw new AppError('Empleado no encontrado', 404, 'NO_ENCONTRADO');
  }

  const rol = await rolRepository.getById(rolId);
  if (!rol) {
    throw new AppError('Rol no encontrado', 404, 'NO_ENCONTRADO');
  }

  const actualizado = await empleadoRepository.update(empleadoId, { rol_id: rolId });
  return quitarContrasena(actualizado);
};

const cambiarPermisos = async (empleadoId, permisos) => {
  const empleado = await empleadoRepository.getById(empleadoId);
  if (!empleado) {
    throw new AppError('Empleado no encontrado', 404, 'NO_ENCONTRADO');
  }

  const actualizado = await empleadoRepository.update(empleadoId, { permisos });
  return quitarContrasena(actualizado);
};

module.exports = {
  cambiarRol,
  cambiarPermisos
};

