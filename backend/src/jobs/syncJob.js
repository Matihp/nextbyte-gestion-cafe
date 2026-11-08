const { dbCloudDirect, setOnlineStatus } = require('../config/db');

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

const sincronizar = async () => ({
  success: false,
  code: 'SYNC_DESHABILITADA',
  message: 'No se sincronizan bases independientes automáticamente. Revisá los pendientes antiguos antes de una migración manual.'
});

const iniciarSyncJob = () => {};
const detenerSyncJob = () => {};

module.exports = { verificarConexionTurso, sincronizar, iniciarSyncJob, detenerSyncJob };
