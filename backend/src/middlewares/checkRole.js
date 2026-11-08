const jwt = require('jsonwebtoken');
const { ROLES_SISTEMA } = require('../constants/roles');

const rutasExentas = ['/api/health', '/api/auth/login'];

const obtenerUsuario = (req) => {
  if (req.user) return req.user;

  if (process.env.AUTH_ENABLED !== 'true') {
    return { id: 'dev', es_admin: true, es_contingencia: false, permisos: ['all'] };
  }

  const cabecera = req.headers && req.headers.authorization;
  if (!cabecera || typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) {
    return null;
  }

  const token = cabecera.slice(7).trim();
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET || 'secreto_super_seguro_dev';
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

const checkRoleOffline = (req, res, next) => {
  if (req.databaseMode === 'cloud' || req.databaseMode === 'local' || req.isOnline) {
    return next();
  }

  if (req.method === 'GET') {
    return next();
  }

  const ruta = req.originalUrl || req.url;
  const esExenta = rutasExentas.some((exenta) => ruta.startsWith(exenta));
  if (esExenta) {
    return next();
  }

  const usuario = obtenerUsuario(req);
  const esAutorizado = usuario && (
    usuario.es_admin ||
    usuario.es_contingencia ||
    usuario.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL
  );

  if (!esAutorizado) {
    return res.status(403).json({
      success: false,
      error: 'SIN_CONEXION',
      message: 'Sin conexión a internet. Solo el rol Administrador o Cajero Principal puede realizar operaciones sin conexión.'
    });
  }

  req.user = usuario;
  return next();
};

module.exports = checkRoleOffline;
