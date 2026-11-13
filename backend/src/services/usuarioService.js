const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const empleadoRepository = require('../repositories/empleadoRepository');
const rolRepository = require('../repositories/rolRepository');
const { esEmailValido, quitarContrasena } = require('../dtos/empleado.dto');
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

const obtenerTodos = async () => {
  // Retorna únicamente a quienes tienen usuario habilitado en el sistema
  const usuarios = await empleadoRepository.getAll({ tiene_usuario: true });
  return quitarContrasena(usuarios);
};

const obtenerPorId = async (id) => {
  const usuario = await empleadoRepository.getById(id);
  if (!usuario || !usuario.tiene_usuario) {
    throw new AppError('Usuario no encontrado o sin acceso', 404, 'NO_ENCONTRADO');
  }
  return quitarContrasena(usuario);
};

const crear = async (datos) => {
  const { nombre, apellido, email, contrasena, rol_id, permisos } = datos;

  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    throw new AppError('El nombre es obligatorio', 400, 'VALIDACION');
  }
  if (!apellido || typeof apellido !== 'string' || apellido.trim() === '') {
    throw new AppError('El apellido es obligatorio', 400, 'VALIDACION');
  }
  if (!email || !esEmailValido(email)) {
    throw new AppError('Email inválido', 400, 'VALIDACION');
  }
  if (!contrasena || typeof contrasena !== 'string' || contrasena.length < 6) {
    throw new AppError('La contraseña debe tener al menos 6 caracteres', 400, 'VALIDACION');
  }
  if (!rol_id) {
    throw new AppError('El rol es obligatorio', 400, 'VALIDACION');
  }

  const rol = await rolRepository.getById(rol_id);
  if (!rol) {
    throw new AppError('El rol especificado no existe', 404, 'NO_ENCONTRADO');
  }

  const emailLimpio = email.trim();
  const existenteEmail = await empleadoRepository.getByEmail(emailLimpio);
  if (existenteEmail) {
    // Si ya existe como empleado pero sin usuario, le habilitamos el usuario
    if (existenteEmail.es_empleado && !existenteEmail.tiene_usuario) {
      await validarLimiteRolContingencia(rol_id, existenteEmail.id);
      const contrasenaHash = bcrypt.hashSync(contrasena, 10);
      const reactivado = await empleadoRepository.update(existenteEmail.id, {
        tiene_usuario: true,
        rol_id,
        contrasena: contrasenaHash,
        permisos: Array.isArray(permisos) ? permisos : []
      });
      return quitarContrasena(reactivado);
    }
    throw new AppError('Ya existe un usuario o empleado con ese email', 409, 'DUPLICADO');
  }

  await validarLimiteRolContingencia(rol_id);

  const contrasenaHash = bcrypt.hashSync(contrasena, 10);

  // Un usuario creado directamente desde Configuración NO es empleado del comercio
  const payload = {
    id: crypto.randomUUID(),
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: emailLimpio,
    contrasena: contrasenaHash,
    rol_id,
    permisos: Array.isArray(permisos) ? permisos : [],
    es_empleado: false,
    tiene_usuario: true,
    foto: datos.foto ? datos.foto.trim() : null
  };

  const nuevoUsuario = await empleadoRepository.create(payload);
  return quitarContrasena(nuevoUsuario);
};

const actualizar = async (id, datos, currentUser) => {
  const usuario = await empleadoRepository.getById(id);
  if (!usuario || !usuario.tiene_usuario) {
    throw new AppError('Usuario no encontrado', 404, 'NO_ENCONTRADO');
  }

  const esAdmin = Boolean(
    usuario.id === '11111111-1111-1111-1111-111111111111' ||
    usuario.email === 'admin@nextbyte.com' ||
    usuario.es_admin ||
    usuario.rol_id === '48575788-681d-47dc-b0ed-11cd402ca182'
  );

  if (esAdmin) {
    if (datos.rol_id && datos.rol_id !== usuario.rol_id) {
      throw new AppError('No se puede cambiar el rol del usuario Administrador', 403, 'PROHIBIDO');
    }
    if (datos.permisos && !datos.permisos.includes('all')) {
      throw new AppError('No se pueden modificar los permisos del usuario Administrador', 403, 'PROHIBIDO');
    }
  }

  const payload = {};
  if (datos.nombre !== undefined) payload.nombre = datos.nombre.trim();
  if (datos.apellido !== undefined) payload.apellido = datos.apellido.trim();
  if (datos.email !== undefined && datos.email.trim() !== usuario.email) {
    const emailLimpio = datos.email.trim();
    if (!esEmailValido(emailLimpio)) throw new AppError('Email inválido', 400, 'VALIDACION');
    const existente = await empleadoRepository.getByEmail(emailLimpio);
    if (existente && existente.id !== id) {
      throw new AppError('Email ya registrado por otro usuario', 409, 'DUPLICADO');
    }
    payload.email = emailLimpio;
  }
  if (datos.contrasena) {
    if (datos.contrasena.length < 6) throw new AppError('La contraseña debe tener al menos 6 caracteres', 400, 'VALIDACION');
    payload.contrasena = bcrypt.hashSync(datos.contrasena, 10);
  }
  if (datos.rol_id !== undefined) {
    if (datos.rol_id !== null) {
      const rol = await rolRepository.getById(datos.rol_id);
      if (!rol) throw new AppError('El rol especificado no existe', 404, 'NO_ENCONTRADO');
      await validarLimiteRolContingencia(datos.rol_id, id);
    }
    payload.rol_id = datos.rol_id;
  }
  if (datos.permisos !== undefined) {
    payload.permisos = Array.isArray(datos.permisos) ? datos.permisos : [];
  }
  if (datos.foto !== undefined) {
    payload.foto = datos.foto ? datos.foto.trim() : null;
  }

  if (currentUser && !currentUser.es_admin) {
    delete payload.rol_id;
    delete payload.permisos;
  }

  const actualizado = await empleadoRepository.update(id, payload);
  return quitarContrasena(actualizado);
};

const eliminar = async (id, currentUser) => {
  const usuario = await empleadoRepository.getById(id);
  if (!usuario || !usuario.tiene_usuario) {
    throw new AppError('Usuario no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (currentUser && currentUser.id === id) {
    throw new AppError('No puedes eliminar tu propio usuario', 409, 'CONFLICTO');
  }

  // Protección del Administrador principal del sistema
  if (usuario.id === '11111111-1111-1111-1111-111111111111' || usuario.email === 'admin@nextbyte.com') {
    throw new AppError('No se puede eliminar al usuario Administrador principal del sistema', 403, 'PROHIBIDO');
  }

  // Protección del rol de administrador
  if (usuario.es_admin || usuario.rol_id === '48575788-681d-47dc-b0ed-11cd402ca182') {
    const todos = await empleadoRepository.getAll({ tiene_usuario: true });
    const admins = todos.filter((u) => u.es_admin || u.rol_id === '48575788-681d-47dc-b0ed-11cd402ca182');
    if (admins.length <= 1) {
      throw new AppError('No se puede eliminar el único usuario administrador del sistema', 409, 'CONFLICTO');
    }
  }

  // ⚠️ REGLA CRUCIAL DEL NEGOCIO:
  // Si el usuario es además empleado del comercio:
  // BAJO NINGÚN CONCEPTO SE DEBE ELIMINAR EL EMPLEADO DEL COMERCIO.
  // Solo se le revoca/elimina su acceso de usuario al sistema.
  if (usuario.es_empleado) {
    await empleadoRepository.update(id, {
      tiene_usuario: false,
      rol_id: null,
      permisos: []
    });
    return {
      id,
      es_empleado: true,
      mensaje: 'Acceso de usuario eliminado del sistema. El empleado permanece activo en el comercio.'
    };
  } else {
    // Si NO es empleado del comercio (ej. administrador externo, dueño, etc.)
    // se elimina el registro por completo
    await empleadoRepository.delete(id);
    return {
      id,
      es_empleado: false,
      mensaje: 'Usuario del sistema eliminado exitosamente.'
    };
  }
};

const cambiarRol = async (empleadoId, rolId) => {
  const empleado = await empleadoRepository.getById(empleadoId);
  if (!empleado) {
    throw new AppError('Usuario no encontrado', 404, 'NO_ENCONTRADO');
  }

  const rol = await rolRepository.getById(rolId);
  if (!rol) {
    throw new AppError('Rol no encontrado', 404, 'NO_ENCONTRADO');
  }

  await validarLimiteRolContingencia(rolId, empleadoId);

  const actualizado = await empleadoRepository.update(empleadoId, { rol_id: rolId });
  return quitarContrasena(actualizado);
};

const cambiarPermisos = async (empleadoId, permisos) => {
  const empleado = await empleadoRepository.getById(empleadoId);
  if (!empleado) {
    throw new AppError('Usuario no encontrado', 404, 'NO_ENCONTRADO');
  }

  const actualizado = await empleadoRepository.update(empleadoId, { permisos });
  return quitarContrasena(actualizado);
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  cambiarRol,
  cambiarPermisos
};
