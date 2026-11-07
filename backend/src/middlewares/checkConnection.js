const {
  isOnline: getIsOnline,
  setOnlineStatus,
  hasPendingLocalSync,
  setPendingLocalSync
} = require('../config/db');
const syncService = require('../services/syncService');
const syncJob = require('../jobs/syncJob');

let cachedOnline = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 3000;

/**
 * Middleware para verificar si hay conexión a internet activa y enrutar
 * las peticiones a Turso Cloud o a SQLite local (modo contingencia).
 */
const checkConnection = async (req, res, next) => {
  // En entorno de tests, respetamos el estado asignado o por defecto online
  if (process.env.NODE_ENV === 'test') {
    if (req.isOnline === undefined) {
      req.isOnline = true;
    }
    return next();
  }

  try {
    const ahora = Date.now();
    const estadoActual = getIsOnline();

    if (estadoActual) {
      cachedOnline = true;
    } else {
      if (cachedOnline === false && ahora - lastCheckTime > 5000) {
        cachedOnline = await syncJob.verificarConexionTurso(2000);
        lastCheckTime = ahora;
        setOnlineStatus(cachedOnline);
      }
    }

    let isOnline = cachedOnline !== null ? cachedOnline : estadoActual;

    if (isOnline) {
      const hasPendingData = hasPendingLocalSync() || (await syncService.hayPendientes());
      if (hasPendingData) {
        isOnline = false;
        syncJob.sincronizar().catch(() => {});
      }
    }

    req.isOnline = isOnline;

    if (!req.isOnline && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setPendingLocalSync(true);
        }
      });
    }

    next();
  } catch (error) {
    console.error('❌ Error al verificar conexión/sincronización:', error.message);
    req.isOnline = false;
    next();
  }
};

module.exports = checkConnection;
