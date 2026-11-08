const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const empleadoRepository = require('../repositories/empleadoRepository');
const rolRepository = require('../repositories/rolRepository');
const { ROLES_SISTEMA } = require('../constants/roles');

const armarUsuario = (empleado, rol) => {
  const permisosEmpleado = Array.isArray(empleado?.permisos) ? empleado.permisos : [];
  const permisosRol = rol && Array.isArray(rol.permisos) ? rol.permisos : [];
  const permisos = Array.from(new Set([...permisosEmpleado, ...permisosRol]));
  const es_admin = Boolean(rol && rol.es_admin);
  const es_contingencia = Boolean(
    (empleado && empleado.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL) ||
    (rol && rol.id === ROLES_SISTEMA.CAJERO_PRINCIPAL)
  );

  const usuario = {
    id: empleado.id,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    email: empleado.email,
    rol_id: empleado.rol_id,
    es_admin,
    es_contingencia,
    permisos,
    es_empleado: Boolean(empleado.es_empleado),
    tiene_usuario: Boolean(empleado.tiene_usuario),
    foto: empleado.foto || null
  };

  const payload = {
    id: empleado.id,
    rol_id: empleado.rol_id,
    es_admin,
    es_contingencia,
    permisos
  };

  return { usuario, payload };
};

const login = async (datos, contrasenaAlternativa) => {
  const email = typeof datos === 'object' && datos !== null ? datos.email : datos;
  const contrasena = typeof datos === 'object' && datos !== null ? datos.contrasena : contrasenaAlternativa;

  if (!email || !contrasena) {
    throw new AppError('El email y la contraseña son obligatorios', 400, 'VALIDACION');
  }

  const empleado = await empleadoRepository.getByEmail(email);
  if (!empleado) {
    throw new AppError('Credenciales inválidas', 401, 'CREDENCIALES_INVALIDAS');
  }

  if (empleado.tiene_usuario === false || empleado.tiene_usuario === 0) {
    throw new AppError('El usuario no tiene acceso habilitado al sistema', 401, 'CREDENCIALES_INVALIDAS');
  }

  const contrasenaValida = await bcrypt.compare(contrasena, empleado.contrasena);
  if (!contrasenaValida) {
    throw new AppError('Credenciales inválidas', 401, 'CREDENCIALES_INVALIDAS');
  }

  const rol = empleado.rol_id ? await rolRepository.getById(empleado.rol_id) : null;
  const { usuario, payload } = armarUsuario(empleado, rol);

  const secret = process.env.JWT_SECRET || 'secreto_super_seguro_dev';
  const token = jwt.sign(payload, secret, { expiresIn: '8h' });

  return { token, usuario };
};

const me = async (user) => {
  if (!user || !user.id) {
    throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
  }

  const empleado = await empleadoRepository.getById(user.id);
  if (!empleado) {
    return {
      id: user.id,
      rol_id: user.rol_id || null,
      es_admin: Boolean(user.es_admin),
      es_contingencia: Boolean(user.es_contingencia || user.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL),
      permisos: Array.isArray(user.permisos) ? user.permisos : []
    };
  }

  const rol = empleado.rol_id ? await rolRepository.getById(empleado.rol_id) : null;
  const { usuario } = armarUsuario(empleado, rol);
  return usuario;
};

module.exports = {
  armarUsuario,
  login,
  me
};
