const AppError = require('../utils/AppError');

const authActivada = () => process.env.AUTH_ENABLED === 'true';

const authRequired = (req, res, next) => {
  if (!authActivada()) return next();
  throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
};

const requireAdmin = (req, res, next) => {
  if (!authActivada()) return next();
  throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
};

const requirePermiso = (permiso) => (req, res, next) => {
  if (!authActivada()) return next();
  throw new AppError(`No autenticado (se requiere el permiso "${permiso}")`, 401, 'NO_AUTENTICADO');
};

module.exports = { authRequired, requireAdmin, requirePermiso };
