const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { quitarContrasena, validarEmpleado } = require('../dtos/empleado.dto');
const empleadoRepository = require('../repositories/empleadoRepository');
const rolRepository = require('../repositories/rolRepository');
const { ROLES_SISTEMA } = require('../constants/roles');

const esRolCajaContingencia = async (rolId) => {
  return rolId === ROLES_SISTEMA.CAJERO_PRINCIPAL;
};

const validarLimiteRolContingencia = async (rolId, excludeUsuarioId = null) => {
  if (rolId !== ROLES_SISTEMA.CAJERO_PRINCIPAL) return;

  const todos = await empleadoRepository.getAll();
  const yaAsignado = todos.find((u) => {
    if (excludeUsuarioId && u.id === excludeUsuarioId) return false;
    if (!u.tiene_usuario) return false;
    return u.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL;
  });

  if (yaAsignado) {
    throw new AppError(
      'Solo puede existir un usuario activo con el rol de Cajero Principal (Contingencia)',
      409,
      'LIMITE_ROL_CONTINGENCIA'
    );
  }
};

const obtenerTodos = async (filtros = {}) => {
  const queryFiltros = { ...filtros };
  if (queryFiltros.es_empleado === undefined) {
    queryFiltros.es_empleado = true;
  }
  const empleados = await empleadoRepository.getAll(queryFiltros);
  return quitarContrasena(empleados);
};

const obtenerPorId = async (id) => {
  const empleado = await empleadoRepository.getById(id);
  if (!empleado) {
    throw new AppError('Empleado no encontrado', 404, 'NO_ENCONTRADO');
  }
  return quitarContrasena(empleado);
};

const crear = async (datos) => {
  const errores = validarEmpleado(datos, { esEdicion: false });
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  if (datos.rol_id) {
    const rol = await rolRepository.getById(datos.rol_id);
    if (!rol) {
      throw new AppError('El rol especificado no existe', 404, 'NO_ENCONTRADO');
    }
    await validarLimiteRolContingencia(datos.rol_id);
  }

  const emailLimpio = datos.email.trim();
  const legajoLimpio = datos.legajo.trim();

  const existenteEmail = await empleadoRepository.getByEmail(emailLimpio);
  if (existenteEmail) {
    throw new AppError('Ya existe un empleado con ese email', 409, 'DUPLICADO');
  }

  const existenteLegajo = await empleadoRepository.getByLegajo(legajoLimpio);
  if (existenteLegajo) {
    throw new AppError('Ya existe un empleado con ese legajo', 409, 'DUPLICADO');
  }

  const contrasenaHash = bcrypt.hashSync(datos.contrasena, 10);

  const payload = {
    id: crypto.randomUUID(),
    rol_id: datos.rol_id || null,
    legajo: legajoLimpio,
    nombre: datos.nombre.trim(),
    apellido: datos.apellido.trim(),
    email: emailLimpio,
    contrasena: contrasenaHash,
    telefono: datos.telefono ? datos.telefono.trim() : null,
    foto: datos.foto ? datos.foto.trim() : null,
    fecha_nacimiento: datos.fecha_nacimiento || null,
    fecha_ingreso: datos.fecha_ingreso || null,
    turno_habitual: datos.turno_habitual || null,
    dias_franco: Array.isArray(datos.dias_franco) ? datos.dias_franco : [],
    permisos: Array.isArray(datos.permisos) ? datos.permisos : [],
    es_empleado: true,
    tiene_usuario: true
  };

  const nuevoEmpleado = await empleadoRepository.create(payload);
  return quitarContrasena(nuevoEmpleado);
};

const actualizar = async (id, datos, usuario) => {
  const empleado = await empleadoRepository.getById(id);
  if (!empleado) {
    throw new AppError('Empleado no encontrado', 404, 'NO_ENCONTRADO');
  }

  const errores = validarEmpleado(datos, { esEdicion: true });
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const cambiaEmail = datos.email !== undefined && datos.email.trim() !== empleado.email;
  const cambiaContrasena = Boolean(datos.contrasena);

  if ((cambiaEmail || cambiaContrasena) && usuario && !usuario.es_admin) {
    throw new AppError('Se requiere rol de administrador para modificar email o contraseña', 403, 'NO_AUTORIZADO');
  }

  if (datos.rol_id !== undefined && datos.rol_id !== null) {
    const rol = await rolRepository.getById(datos.rol_id);
    if (!rol) {
      throw new AppError('El rol especificado no existe', 404, 'NO_ENCONTRADO');
    }
    await validarLimiteRolContingencia(datos.rol_id, id);
  }

  if (cambiaEmail) {
    const emailLimpio = datos.email.trim();
    const existenteEmail = await empleadoRepository.getByEmail(emailLimpio);
    if (existenteEmail && existenteEmail.id !== id) {
      throw new AppError('Ya existe un empleado con ese email', 409, 'DUPLICADO');
    }
  }

  if (datos.legajo !== undefined && datos.legajo.trim() !== empleado.legajo) {
    const legajoLimpio = datos.legajo.trim();
    const existenteLegajo = await empleadoRepository.getByLegajo(legajoLimpio);
    if (existenteLegajo && existenteLegajo.id !== id) {
      throw new AppError('Ya existe un empleado con ese legajo', 409, 'DUPLICADO');
    }
  }

  const payload = {};

  if (datos.nombre !== undefined) payload.nombre = datos.nombre.trim();
  if (datos.apellido !== undefined) payload.apellido = datos.apellido.trim();
  if (datos.legajo !== undefined) payload.legajo = datos.legajo.trim();
  if (datos.email !== undefined) payload.email = datos.email.trim();
  if (datos.rol_id !== undefined) payload.rol_id = datos.rol_id;
  if (datos.contrasena) payload.contrasena = bcrypt.hashSync(datos.contrasena, 10);
  if (datos.telefono !== undefined) payload.telefono = datos.telefono ? datos.telefono.trim() : null;
  if (datos.foto !== undefined) payload.foto = datos.foto ? datos.foto.trim() : null;
  if (datos.fecha_nacimiento !== undefined) payload.fecha_nacimiento = datos.fecha_nacimiento;
  if (datos.fecha_ingreso !== undefined) payload.fecha_ingreso = datos.fecha_ingreso;
  if (datos.turno_habitual !== undefined) payload.turno_habitual = datos.turno_habitual;
  if (datos.dias_franco !== undefined) payload.dias_franco = datos.dias_franco;
  if (datos.permisos !== undefined) payload.permisos = datos.permisos;

  const actualizado = await empleadoRepository.update(id, payload);
  return quitarContrasena(actualizado);
};

const eliminar = async (id, usuario) => {
  const empleado = await empleadoRepository.getById(id);
  if (!empleado) {
    throw new AppError('Empleado no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (usuario && usuario.id === id) {
    throw new AppError('No puedes eliminar tu propio usuario', 409, 'CONFLICTO');
  }

  await empleadoRepository.delete(id);
  return { id, mensaje: 'Empleado y su usuario eliminados correctamente' };
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar
};
