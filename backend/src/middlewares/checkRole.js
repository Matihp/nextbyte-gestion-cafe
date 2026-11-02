const jwt = require('jsonwebtoken');

const rutasExentas = ['/api/health', '/api/auth/login'];

const obtenerUsuario = (req) => {
  if (req.user) return req.user;

  if (process.env.AUTH_ENABLED !== 'true') {
    return { id: 'dev', es_admin: true, permisos: ['all'] };
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
  if (req.isOnline) {
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
  if (!usuario || !usuario.es_admin) {
    return res.status(403).json({
      success: false,
      error: 'SIN_CONEXION',
      message: 'Sin conexión a internet. Solo el rol Administrador puede realizar operaciones sin conexión.'
    });
  }

  req.user = usuario;
  return next();
};

module.exports = checkRoleOffline;
