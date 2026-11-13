const path = require('path');
const fs = require('fs');
const knex = require('knex');
const knexConfig = require('../../knexfile');
const { executeBootstrap, applyIncrementalJournal } = require('../services/bootstrapService');
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
  if (!fs.existsSync(dbPath)) {
    return false;
  }

  try {
    const stats = fs.statSync(dbPath);
    if (!stats.isFile() || stats.size === 0) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const connectivity = getConnectivityService();
    if (connectivity && typeof connectivity.getState === 'function') {
      const state = connectivity.getState();
      if (state && state.localReady !== undefined) {
        return Boolean(state.localReady);
      }
    }
  } catch {}

  return true;
}

async function initContingencyOnBoot({ sourceDb, writerId = 'wr_caja_principal' }) {
  const dbPath = getContingencyDbPath();
  const exists = fs.existsSync(dbPath);
  const connectivity = getConnectivityService();

  if (!exists && sourceDb) {
    try {
      await executeBootstrap({
        sourceDb,
        targetDbPath: dbPath,
        writerId
      });
      connectivity.setLocalMirrorState({ ready: true, reason: null });
    } catch (err) {
      connectivity.setLocalMirrorState({ ready: false, reason: 'BOOTSTRAP_FALLO' });
    }
  } else if (exists) {
    try {
      const db = getContingencyDb();
      if (sourceDb) {
        const hayPendientes = await db('operation_outbox')
          .whereIn('status', ['pending', 'sending', 'uncertain', 'conflict', 'prepared'])
          .first()
          .catch(() => null);

        const stateRow = await db('contingency_state').where({ id: 'local' }).first().catch(() => null);
        if (!hayPendientes && stateRow?.bootstrap_status === 'READY') {
          try {
            await applyIncrementalJournal({ sourceDb, targetDb: db });
          } catch (incErr) {
            console.warn('Aviso al aplicar journal incremental en boot:', incErr.message);
          }
        } else if (!hayPendientes && (!stateRow || stateRow.bootstrap_status !== 'READY')) {
          try {
            await closeContingencyDb();
            await executeBootstrap({
              sourceDb,
              targetDbPath: dbPath,
              writerId
            });
          } catch (bootErr) {
            console.warn('Aviso al ejecutar bootstrap inicial en boot:', bootErr.message);
          }
        }
      }

      const freshDb = getContingencyDb();
      const state = await freshDb('contingency_state').where({ id: 'local' }).first().catch(() => null);
      const isReady = state?.bootstrap_status === 'READY';
      connectivity.setLocalMirrorState({
        ready: isReady,
        reason: isReady ? null : 'BOOTSTRAP_PENDIENTE',
        lastCloudSeq: Number(state?.last_cloud_seq_applied || 0)
      });
      if (isReady && !sourceDb && connectivity.mode === 'starting') {
        connectivity.mode = 'offline_active';
        connectivity.reason = 'INTERNET_UNREACHABLE';
      }
    } catch (err) {
      connectivity.setLocalMirrorState({ ready: false, reason: 'ERROR_INICIALIZACION_LOCAL' });
    }
  }
}

async function closeContingencyDb() {
  if (contingencyKnexInstance) {
    try {
      await contingencyKnexInstance.destroy();
    } catch {
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
