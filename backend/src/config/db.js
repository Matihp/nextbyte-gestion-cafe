const knex = require('knex');
const knexConfig = require('../../knexfile');
const { isNetworkError, isCloudUnavailable } = require('./databaseErrors');

const environment = process.env.NODE_ENV || 'development';
const hasTurso = Boolean(process.env.TURSO_DB_URL && process.env.TURSO_AUTH_TOKEN);
const configuredMode = process.env.DB_MODE;
if (configuredMode && !['cloud', 'local'].includes(configuredMode)) {
  throw new Error('DB_MODE debe ser cloud o local');
}
const databaseMode = environment === 'test' ? 'test' : configuredMode || (hasTurso ? 'cloud' : 'local');
if (databaseMode === 'cloud' && !hasTurso) {
  throw new Error('DB_MODE=cloud requiere TURSO_DB_URL y TURSO_AUTH_TOKEN');
}
if (environment !== 'test' && !configuredMode && !hasTurso
    && (process.env.TURSO_DB_URL || process.env.TURSO_AUTH_TOKEN || environment === 'production')) {
  throw new Error('Configuración incompleta: configurá Turso o elegí explícitamente DB_MODE=local');
}

// One authority for the entire process. Connectivity never changes this reference.
const dbLocal = knex(knexConfig[databaseMode === 'cloud' ? 'turso' : databaseMode === 'test' ? 'test' : environment] || knexConfig.development);
const dbLocalDirect = databaseMode === 'cloud' ? null : dbLocal;
const dbCloudDirect = databaseMode === 'cloud' ? dbLocal : null;
let online = databaseMode === 'test';
let pendingLocalSync = false;
let lastSyncTime = null;
let initialization;

dbLocal.on('query-response', () => {
  if (databaseMode === 'cloud') online = true;
});
dbLocal.on('query-error', (error) => {
  if (databaseMode === 'cloud' && isCloudUnavailable(error)) online = false;
});

const initializeDatabase = () => {
  if (!initialization) initialization = (async () => {
    await dbLocal.raw('SELECT 1');
    if (databaseMode !== 'cloud' || process.env.DB_AUTO_MIGRATE === 'true') {
      await dbLocal.migrate.latest();
    }
    if (databaseMode === 'local') {
      const count = await dbLocal('roles').count('id as count').first();
      if (Number(count.count) === 0) await dbLocal.seed.run();
    }
    console.log(`✅ Base principal conectada: ${databaseMode === 'cloud' ? 'Turso Cloud' : 'SQLite local'}. Sin cambio automático de base.`);
  })();
  return initialization;
};

module.exports = {
  dbLocal,
  dbLocalDirect,
  dbCloudDirect,
  databaseMode,
  initializeDatabase,
  getActiveDb: () => dbLocal,
  isOnline: () => online,
  setOnlineStatus: (value) => { online = Boolean(value); },
  hasPendingLocalSync: () => pendingLocalSync,
  setPendingLocalSync: (value) => { pendingLocalSync = Boolean(value); },
  getLastSyncTime: () => lastSyncTime,
  setLastSyncTime: (value) => { lastSyncTime = value; },
  isNetworkError
};
