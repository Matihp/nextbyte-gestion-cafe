const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const empleadoRepository = require('../repositories/empleadoRepository');
const rolRepository = require('../repositories/rolRepository');
const { ROLES_SISTEMA } = require('../constants/roles');
const { isNetworkError, isCloudUnavailable } = require('../config/databaseErrors');

const getContingencyDb = () => {
  try {
    const helper = require('../config/contingencyDb');
    if (helper && helper.isContingencyReady()) {
      return helper.getContingencyDb();
    }
  } catch {}
  return null;
};

const isSystemOffline = () => {
  try {
    const { getConnectivityService } = require('./connectivityService');
    const state = getConnectivityService().getState();
    return Boolean(
      state.mode === 'OFFLINE_ACTIVE' ||
      state.mode === 'CLOUD_UNAVAILABLE' ||
      !state.isOnline
    );
  } catch {
    return false;
  }
};

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

const cargarEmpleadoLocal = async (localDb, email) => {
  const empleado = await localDb('empleados').where({ email }).first();
  if (!empleado) return { empleado: null, rol: null };

  if (empleado.dias_franco && typeof empleado.dias_franco === 'string') {
    try { empleado.dias_franco = JSON.parse(empleado.dias_franco); } catch { empleado.dias_franco = []; }
  }
  if (empleado.permisos && typeof empleado.permisos === 'string') {
    try { empleado.permisos = JSON.parse(empleado.permisos); } catch { empleado.permisos = []; }
  }

  let rol = null;
  if (empleado.rol_id) {
    rol = await localDb('roles').where({ id: empleado.rol_id }).first();
    if (rol && rol.permisos && typeof rol.permisos === 'string') {
      try { rol.permisos = JSON.parse(rol.permisos); } catch { rol.permisos = []; }
    }
  }

  return { empleado, rol };
};

const login = async (datos, contrasenaAlternativa) => {
  const email = typeof datos === 'object' && datos !== null ? datos.email : datos;
  const contrasena = typeof datos === 'object' && datos !== null ? datos.contrasena : contrasenaAlternativa;

  if (!email || !contrasena) {
    throw new AppError('El email y la contraseña son obligatorios', 400, 'VALIDACION');
  }

  const localDb = getContingencyDb();
  const offlineMode = isSystemOffline() && Boolean(localDb);

  let empleado = null;
  let rol = null;
  let autenticadoOffline = false;

  if (offlineMode) {
    const cargado = await cargarEmpleadoLocal(localDb, email);
    empleado = cargado.empleado;
    rol = cargado.rol;
    if (empleado) autenticadoOffline = true;
  } else {
    try {
      empleado = await empleadoRepository.getByEmail(email);
      if (empleado && empleado.rol_id) {
        rol = await rolRepository.getById(empleado.rol_id);
      }
    } catch (err) {
      if (localDb && (isNetworkError(err) || isCloudUnavailable(err))) {
        const cargado = await cargarEmpleadoLocal(localDb, email);
        empleado = cargado.empleado;
        rol = cargado.rol;
        if (empleado) autenticadoOffline = true;
      } else {
        throw err;
      }
    }
  }

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

  if (autenticadoOffline) {
    const esCajeroAutorizado = Boolean(
      empleado.es_contingencia ||
      empleado.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL ||
      (rol && (rol.id === ROLES_SISTEMA.CAJERO_PRINCIPAL || rol.es_contingencia))
    );

    if (!esCajeroAutorizado) {
      throw new AppError('Sin conexión a internet. Solo el Cajero Principal de contingencia puede iniciar sesión en modo offline.', 403, 'OFFLINE_FORBIDDEN');
    }
  }

  const { usuario, payload } = armarUsuario(empleado, rol);
  const secret = process.env.JWT_SECRET || 'secreto_super_seguro_dev';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  const token = jwt.sign(payload, secret, { expiresIn });

  return { token, usuario };
};

const me = async (user) => {
  if (!user || !user.id) {
    throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
  }

  let empleado = null;
  let rol = null;
  try {
    empleado = await empleadoRepository.getById(user.id);
    if (empleado && empleado.rol_id) {
      rol = await rolRepository.getById(empleado.rol_id);
    }
  } catch (err) {
    const localDb = getContingencyDb();
    if (localDb) {
      try {
        empleado = await localDb('empleados').where({ id: user.id }).first();
        if (empleado) {
          if (empleado.dias_franco && typeof empleado.dias_franco === 'string') {
            try { empleado.dias_franco = JSON.parse(empleado.dias_franco); } catch { empleado.dias_franco = []; }
          }
          if (empleado.permisos && typeof empleado.permisos === 'string') {
            try { empleado.permisos = JSON.parse(empleado.permisos); } catch { empleado.permisos = []; }
          }
          if (empleado.rol_id) {
            rol = await localDb('roles').where({ id: empleado.rol_id }).first();
            if (rol && rol.permisos && typeof rol.permisos === 'string') {
              try { rol.permisos = JSON.parse(rol.permisos); } catch { rol.permisos = []; }
            }
          }
        }
      } catch {}
    }
  }

  if (!empleado) {
    return {
      id: user.id,
      rol_id: user.rol_id || null,
      es_admin: Boolean(user.es_admin),
      es_contingencia: Boolean(user.es_contingencia || user.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL),
      permisos: Array.isArray(user.permisos) ? user.permisos : []
    };
  }

  const { usuario } = armarUsuario(empleado, rol);
  return usuario;
};

module.exports = {
  armarUsuario,
  login,
  me
};
