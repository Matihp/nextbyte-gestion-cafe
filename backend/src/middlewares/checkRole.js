const jwt = require('jsonwebtoken');
const { ROLES_SISTEMA } = require('../constants/roles');
const { getConnectivityService } = require('../services/connectivityService');
const { MODOS_OPERATIVOS, CODIGOS_ERROR } = require('../constants/contingencia');
const { requestContext } = require('../config/db');

const rutasExentas = ['/api/health', '/api/auth/login', '/api/sync/status'];

const ALLOWLIST_OFFLINE = [
  { prefix: '/api/health', methods: ['GET', 'POST'] },
  { prefix: '/api/auth/login', methods: ['POST'] },
  { prefix: '/api/auth/me', methods: ['GET'] },
  { prefix: '/api/sync/status', methods: ['GET'] },
  { prefix: '/api/pedidos', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/comandas', methods: ['GET', 'PATCH'] },
  { prefix: '/api/caja', methods: ['GET', 'POST', 'DELETE'] },
  { prefix: '/api/productos', methods: ['GET'] },
  { prefix: '/api/categorias', methods: ['GET'] },
  { prefix: '/api/reportes/caja', methods: ['GET'] },
  { prefix: '/api/insumos', methods: ['GET'] }
];

const esRutaPermitidaOffline = (ruta, method) => {
  return ALLOWLIST_OFFLINE.some((item) => {
    return ruta.startsWith(item.prefix) && item.methods.includes(method.toUpperCase());
  });
};

const obtenerUsuario = (req) => {
  if (req.user) return req.user;

  if (process.env.AUTH_ENABLED !== 'true') {
    return { id: 'dev', es_admin: true, es_contingencia: true, rol_id: ROLES_SISTEMA.CAJERO_PRINCIPAL, permisos: ['all'] };
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
  const ruta = req.originalUrl || req.url;

  if (!ruta.startsWith('/api')) {
    return next();
  }

  const connectivity = getConnectivityService({ databaseMode: req.databaseMode });
  const state = connectivity.getState();

  if (rutasExentas.some((exenta) => ruta.startsWith(exenta))) {
    return next();
  }
  if (state.syncEnabled) {
    if (state.mode === MODOS_OPERATIVOS.CLOUD_UNAVAILABLE && req.method !== 'GET') {
      return res.status(503).json({
        success: false,
        error: CODIGOS_ERROR.CLOUD_UNAVAILABLE,
        message: 'Servicio en la nube no disponible. Intente nuevamente en unos instantes.'
      });
    }

    const helper = (() => {
      try { return require('../config/contingencyDb'); } catch { return null; }
    })();
    const contingenciaLista = Boolean(helper && helper.isContingencyReady());

    const esOffline = state.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE ||
      (!req.isOnline && contingenciaLista) ||
      (!state.isOnline && state.mode !== MODOS_OPERATIVOS.STARTING && state.mode !== MODOS_OPERATIVOS.ONLINE) ||
      (state.mode === MODOS_OPERATIVOS.CHECKING_CONNECTIVITY && contingenciaLista) ||
      (state.mode === MODOS_OPERATIVOS.CLOUD_UNAVAILABLE && contingenciaLista && state.internetStatus === 'unreachable');
    if (esOffline) {
      if (!esRutaPermitidaOffline(ruta, req.method)) {
        return res.status(403).json({
          success: false,
          error: CODIGOS_ERROR.OFFLINE_FORBIDDEN,
          message: 'Esta funcionalidad no está disponible en modo sin conexión.'
        });
      }

      const usuario = obtenerUsuario(req);
      const esCajeroAutorizado = usuario && (
        usuario.es_contingencia ||
        usuario.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL
      );

      if (!esCajeroAutorizado) {
        return res.status(403).json({
          success: false,
          error: CODIGOS_ERROR.OFFLINE_FORBIDDEN,
          message: 'Sin conexión a internet. Solo el Cajero Principal autorizado puede operar en modo contingencia.'
        });
      }

      req.user = usuario;
      req.isOfflineContingency = true;
      if (requestContext) {
        return requestContext.run({ isOfflineContingency: true }, () => next());
      }
      return next();
    }


    return next();
  }

  if (req.databaseMode === 'cloud' || req.databaseMode === 'local' || req.isOnline) {
    return next();
  }

  if (req.method === 'GET') {
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
