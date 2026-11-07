const {
  isOnline,
  hasPendingLocalSync,
  getLastSyncTime
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
        modo: online ? 'Online (Turso Cloud)' : 'Offline (SQLite Contingencia)',
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
    return res.json({
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
