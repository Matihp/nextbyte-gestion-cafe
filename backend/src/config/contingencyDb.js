const path = require('path');
const fs = require('fs');
const knex = require('knex');
const knexConfig = require('../../knexfile');
const { executeBootstrap } = require('../services/bootstrapService');
const { getConnectivityService } = require('../services/connectivityService');

let contingencyKnexInstance = null;

function getContingencyDbPath() {
  const customPath = process.env.LOCAL_DB_PATH;
  if (customPath) {
    return path.resolve(process.cwd(), customPath);
  }
  return path.resolve(__dirname, '../../data/contingencia.db');
}

function getContingencyDb() {
  if (contingencyKnexInstance) {
    return contingencyKnexInstance;
  }

  const dbPath = getContingencyDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  contingencyKnexInstance = knex({
    client: 'sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(conn, cb) {
        conn.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;', (err) => cb(err, conn));
      }
    },
    migrations: knexConfig.turso?.migrations || { directory: path.join(__dirname, '../db/migrations') },
    seeds: knexConfig.turso?.seeds || { directory: path.join(__dirname, '../db/seeds') }
  });

  return contingencyKnexInstance;
}

function isContingencyReady() {
  const dbPath = getContingencyDbPath();
  return fs.existsSync(dbPath);
}

async function initContingencyOnBoot({ sourceDb, writerId = 'wr_caja_principal' }) {
  const dbPath = getContingencyDbPath();
  const exists = fs.existsSync(dbPath);
  const connectivity = getConnectivityService();

  if (!exists && sourceDb) {
    try {
      console.log('📦 Inicializando base SQLite local de contingencia desde Turso Cloud...');
      await executeBootstrap({
        sourceDb,
        targetDbPath: dbPath,
        writerId
      });
      console.log('✅ Base SQLite de contingencia creada y lista en:', dbPath);
      connectivity.setLocalMirrorState({ ready: true, reason: null });
    } catch (err) {
      console.warn('⚠️ No se pudo completar el bootstrap inicial de contingencia:', err.message);
      connectivity.setLocalMirrorState({ ready: false, reason: 'BOOTSTRAP_FALLO' });
    }
  } else if (exists) {
    try {
      const db = getContingencyDb();
      // Si hay conexión a Turso en el arranque, verificar si podemos actualizar el espejo local
      if (sourceDb) {
        const hayPendientes = await db('operation_outbox')
          .whereIn('status', ['pending', 'sending', 'uncertain'])
          .first()
          .catch(() => null);

        if (!hayPendientes) {
          try {
            console.log('🔄 Actualizando base SQLite local con el estado más reciente de Turso Cloud...');
            await closeContingencyDb();
            await executeBootstrap({
              sourceDb,
              targetDbPath: dbPath,
              writerId
            });
            console.log('✅ Base SQLite local actualizada exitosamente desde Turso Cloud');
          } catch (bootErr) {
            console.warn('Aviso al refrescar base local desde Turso:', bootErr.message);
          }
        }
      }

      const freshDb = getContingencyDb();
      const state = await freshDb('contingency_state').where({ id: 'local' }).first().catch(() => null);
      const isReady = state?.bootstrap_status === 'READY';
      connectivity.setLocalMirrorState({
        ready: isReady,
        reason: isReady ? null : 'BOOTSTRAP_PENDIENTE',
        lastCloudSeq: state?.last_cloud_seq_applied || 0
      });
      if (isReady) {
        console.log('✅ Base SQLite local de contingencia detectada y lista:', dbPath);
        if (!sourceDb && connectivity.mode === 'starting') {
          connectivity.mode = 'offline_active';
          connectivity.reason = 'INTERNET_UNREACHABLE';
        }
      }
    } catch {
      connectivity.setLocalMirrorState({ ready: true, reason: null });
    }
  }
}

async function closeContingencyDb() {
  if (contingencyKnexInstance) {
    try {
      await contingencyKnexInstance.destroy();
    } catch {
      // Ignorar fallos al cerrar
    } finally {
      contingencyKnexInstance = null;
    }
  }
}

module.exports = {
  getContingencyDbPath,
  getContingencyDb,
  isContingencyReady,
  initContingencyOnBoot,
  closeContingencyDb
};

