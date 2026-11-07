/**
 * Background Job / Worker de Sincronización Automática
 */
const {
  dbLocalDirect,
  dbCloudDirect,
  getActiveDb,
  isOnline,
  setOnlineStatus,
  hasPendingLocalSync,
  setPendingLocalSync
} = require('../config/db');
const syncService = require('../services/syncService');

let intervalHandle = null;
let isSyncing = false;

const verificarConexionTurso = async (timeoutMs = 2500) => {
  const db = dbCloudDirect;
  if (!db) return false;

  try {
    const checkPromise = db.raw('SELECT 1');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    );

    await Promise.race([checkPromise, timeoutPromise]);
    return true;
  } catch {
    return false;
  }
};


const sincronizar = async (dbOrigen = (dbLocalDirect || getActiveDb()), dbDestino = dbCloudDirect) => {
  if (isSyncing) {
    return { success: false, message: 'Sincronización en curso' };
  }

  const tienePendientesLocales = hasPendingLocalSync() || (await syncService.hayPendientes(dbOrigen));
  const onlineActual = isOnline();

  if (onlineActual && !tienePendientesLocales) {
    return { success: true, totalSincronizados: 0, message: 'Al día: no hay registros pendientes' };
  }

  isSyncing = true;
  try {
    const hayInternet = await verificarConexionTurso();
    if (!hayInternet) {
      setOnlineStatus(false);
      return { success: false, offline: true, message: 'Sin conexión a Turso Cloud' };
    }

    setOnlineStatus(true);

    if (!tienePendientesLocales) {
      return { success: true, totalSincronizados: 0, message: 'No hay registros pendientes' };
    }

    if (!dbOrigen || !dbDestino) {
      return { success: false, error: 'Bases de datos no disponibles para sincronizar' };
    }

    console.log('🔄 [SyncJob] Iniciando sincronización de registros pendientes hacia Turso Cloud...');
    const resultado = await syncService.reconciliarTablas(dbOrigen, dbDestino);

    const remanentes = await syncService.contarPendientes(dbOrigen);
    if (remanentes === 0) {
      setPendingLocalSync(false);
      console.log(`✅ [SyncJob] Sincronización completada con éxito. ${resultado.totalSincronizados} registros sincronizados.`);
    } else {
      console.log(`⚠️ [SyncJob] Quedan ${remanentes} registros pendientes de sincronizar.`);
    }

    return {
      success: true,
      totalSincronizados: resultado.totalSincronizados,
      remanentes,
      detalles: resultado.detalles
    };
  } catch (error) {
    console.error('❌ [SyncJob] Error durante la sincronización:', error.message);
    return { success: false, error: error.message };
  } finally {
    isSyncing = false;
  }
};

const iniciarSyncJob = (intervalMs = 15000) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  console.log(`⏱️ [SyncJob] Worker de sincronización iniciado (intervalo: ${intervalMs / 1000}s)`);

  setTimeout(() => {
    sincronizar().catch(() => {});
  }, 3000);

  intervalHandle = setInterval(() => {
    sincronizar().catch(() => {});
  }, intervalMs);

  if (intervalHandle.unref) {
    intervalHandle.unref();
  }
};

const detenerSyncJob = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('🛑 [SyncJob] Worker de sincronización detenido');
  }
};

module.exports = {
  verificarConexionTurso,
  sincronizar,
  iniciarSyncJob,
  detenerSyncJob
};
