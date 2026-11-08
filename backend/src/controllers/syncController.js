const {
  isOnline,
  hasPendingLocalSync,
  getLastSyncTime,
  databaseMode
} = require('../config/db');
const syncService = require('../services/syncService');
const syncJob = require('../jobs/syncJob');

const getStatus = async (req, res, next) => {
  try {
    const online = Boolean(req.isOnline !== undefined ? req.isOnline : isOnline());
    const countPendientes = await syncService.contarPendientes();
    const hayPendientes = hasPendingLocalSync() || countPendientes > 0;
    const ultimoSync = getLastSyncTime();

    return res.json({
      success: true,
      data: {
        isOnline: online,
        databaseMode,
        modo: databaseMode === 'local' ? 'SQLite local (base principal)' : databaseMode === 'test' ? 'SQLite de prueba' : online ? 'Online (Turso Cloud)' : 'Turso no disponible (sin fallback)',
        syncEnabled: false,
        hayPendientes,
        pendientesCount: countPendientes,
        ultimoSync
      }
    });
  } catch (error) {
    next(error);
  }
};

const ejecutarSync = async (req, res, next) => {
  try {
    const resultado = await syncJob.sincronizar();
    return res.status(resultado.success ? 200 : 409).json({
      success: Boolean(resultado.success),
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStatus,
  ejecutarSync
};
