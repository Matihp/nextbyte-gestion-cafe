const {
  isOnline,
  hasPendingLocalSync,
  getLastSyncTime,
  databaseMode
} = require('../config/db');
const syncService = require('../services/syncService');
const syncJob = require('../jobs/syncJob');
const { getConnectivityService } = require('../services/connectivityService');
const { parseContingencyConfig } = require('../config/contingencyConfig');

const getStatus = async (req, res, next) => {
  try {
    const config = parseContingencyConfig(process.env, databaseMode);
    const connectivity = getConnectivityService({ databaseMode });
    const state = connectivity.getState(req.user);

    const countPendientes = state.pendingCount || await syncService.contarPendientes();
    const hayPendientes = hasPendingLocalSync() || countPendientes > 0;
    const ultimoSync = state.lastSuccessfulSyncAt || getLastSyncTime();

    return res.json({
      success: true,
      data: {
        ...state,
        syncEnabled: Boolean(config.isContingencyEnabled),
        isOnline: Boolean(state.isOnline),
        databaseMode,
        modo: databaseMode === 'local'
          ? 'SQLite local (base principal)'
          : databaseMode === 'test'
            ? 'SQLite de prueba'
            : state.isOnline
              ? 'Online (Turso Cloud)'
              : 'Turso no disponible (sin fallback)',
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
