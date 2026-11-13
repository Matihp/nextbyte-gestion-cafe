const { dbLocal, dbCloudDirect, setOnlineStatus, databaseMode } = require('../config/db');
const { getConnectivityService } = require('../services/connectivityService');
const { getRecoveryWorker } = require('../services/recoveryWorker');
const { parseContingencyConfig } = require('../config/contingencyConfig');

const verificarConexionTurso = async (timeoutMs = 5000) => {
  if (!dbCloudDirect) return false;
  let timer;
  try {
    await Promise.race([
      dbCloudDirect.raw('SELECT 1'),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout de conexión a Turso')), timeoutMs);
      })
    ]);
    setOnlineStatus(true);
    return true;
  } catch {
    setOnlineStatus(false);
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const sincronizar = async (options = {}) => {
  const config = parseContingencyConfig(process.env, databaseMode);
  if (!config.isContingencyEnabled) {
    return {
      success: false,
      code: 'SYNC_DESHABILITADA',
      message: 'No se sincronizan bases independientes automáticamente. Revisá los pendientes antiguos antes de una migración manual.'
    };
  }

  const helper = (() => {
    try { return require('../config/contingencyDb'); } catch { return null; }
  })();
  const localDb = options.localDb || (helper && helper.isContingencyReady() ? helper.getContingencyDb() : dbLocal);
  const cloudDb = options.cloudDb || dbCloudDirect || dbLocal;
  const worker = getRecoveryWorker();

  return worker.runRecovery({
    localDb,
    cloudDb,
    writerId: config.writerId || 'wr_caja_principal',
    generation: 1
  });
};

const iniciarSyncJob = () => {
  const config = parseContingencyConfig(process.env, databaseMode);
  if (config.isContingencyEnabled) {
    const connectivity = getConnectivityService({ databaseMode });
    connectivity.startIdleMonitor();
  }
};

const detenerSyncJob = () => {
  const connectivity = getConnectivityService({ databaseMode });
  connectivity.stopIdleMonitor();
};

module.exports = {
  verificarConexionTurso,
  sincronizar,
  iniciarSyncJob,
  detenerSyncJob
};
