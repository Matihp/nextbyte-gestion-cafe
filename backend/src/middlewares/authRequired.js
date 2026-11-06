const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const authActivada = () => process.env.AUTH_ENABLED === 'true';

const usuarioDev = {
  id: 'dev',
  es_admin: true,
  permisos: ['all']
};

const authRequired = (req, res, next) => {
  const cabecera = req.headers && req.headers.authorization;
  if (cabecera && typeof cabecera === 'string' && cabecera.startsWith('Bearer ')) {
    const token = cabecera.slice(7).trim();
    if (token && token !== 'demo-token-dev') {
      try {
        const secret = process.env.JWT_SECRET || 'secreto_super_seguro_dev';
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        return next();
      } catch (err) {
        if (authActivada()) {
          throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
        }
      }
    }
  }

  if (!authActivada()) {
    req.user = { ...usuarioDev };
    return next();
  }

  throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
};

const requireAdmin = (req, res, next) => {
  if (!authActivada()) {
    if (!req.user) {
      req.user = { ...usuarioDev };
    }
    return next();
  }

  if (!req.user) {
    throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
  }

  if (!req.user.es_admin) {
    throw new AppError('Acceso denegado: se requiere rol de administrador', 403, 'NO_AUTORIZADO');
  }

  return next();
};

const requirePermiso = (nombre) => (req, res, next) => {
  if (!authActivada()) {
    if (!req.user) {
      req.user = { ...usuarioDev };
    }
    return next();
  }

  if (!req.user) {
    throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
  }

  const permisos = Array.isArray(req.user.permisos) ? req.user.permisos : [];
  const tienePermiso = permisos.includes('all') || permisos.includes(nombre);

  if (!tienePermiso) {
    throw new AppError(`Acceso denegado: se requiere el permiso ${nombre}`, 403, 'NO_AUTORIZADO');
  }

  return next();
};

module.exports = {
  authRequired,
  requireAdmin,
  requirePermiso
};
