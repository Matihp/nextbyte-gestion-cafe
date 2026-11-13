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

const rawDb = knex(knexConfig[databaseMode === 'cloud' ? 'turso' : databaseMode === 'test' ? 'test' : environment] || knexConfig.development);
const dbLocalDirect = databaseMode === 'cloud' ? null : rawDb;
const dbCloudDirect = databaseMode === 'cloud' ? rawDb : null;
let online = databaseMode === 'test';
let pendingLocalSync = false;
let lastSyncTime = null;
let initialization;

rawDb.on('query-response', () => {
  if (databaseMode === 'cloud') {
    online = true;
    try {
      const { getConnectivityService } = require('../services/connectivityService');
      getConnectivityService().reportCloudSuccess();
    } catch {}
  }
});
rawDb.on('query-error', (error) => {
  if (databaseMode === 'cloud' && isCloudUnavailable(error)) {
    online = false;
    try {
      const { getConnectivityService } = require('../services/connectivityService');
      getConnectivityService().reportCloudFailure(error);
    } catch {}
  }
});

// Enrutamiento seguro para contingencia offline del Cajero Principal
let requestContext = null;
if (process.env.CONTINGENCY_ENABLED === 'true' && environment !== 'test') {
  try {
    const { AsyncLocalStorage } = require('async_hooks');
    requestContext = new AsyncLocalStorage();
  } catch {}
}

let dbLocal = rawDb;
if (process.env.CONTINGENCY_ENABLED === 'true' && environment !== 'test' && requestContext) {
  let contingencyHelper = null;
  const getHelper = () => {
    if (!contingencyHelper) {
      try {
        contingencyHelper = require('./contingencyDb');
      } catch {}
    }
    return contingencyHelper;
  };

  dbLocal = new Proxy(rawDb, {
    get(target, prop, receiver) {
      const store = requestContext ? requestContext.getStore() : null;
      const helper = getHelper();
      if (store?.isOfflineContingency && helper && helper.isContingencyReady()) {
        const localDb = helper.getContingencyDb();
        const value = Reflect.get(localDb, prop, receiver);
        return typeof value === 'function' ? value.bind(localDb) : value;
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    },
    apply(target, thisArg, argArray) {
      const store = requestContext ? requestContext.getStore() : null;
      const helper = getHelper();
      if (store?.isOfflineContingency && helper && helper.isContingencyReady()) {
        const localDb = helper.getContingencyDb();
        return Reflect.apply(localDb, thisArg, argArray);
      }
      return Reflect.apply(target, thisArg, argArray);
    }
  });
}

const initializeDatabase = () => {
  if (!initialization) initialization = (async () => {
    await rawDb.raw('SELECT 1');
    try {
      const { getConnectivityService } = require('../services/connectivityService');
      getConnectivityService().reportCloudSuccess();
    } catch {}
    if (databaseMode !== 'cloud' || process.env.DB_AUTO_MIGRATE === 'true') {
      await rawDb.migrate.latest();
    }
    if (databaseMode === 'local') {
      const count = await rawDb('roles').count('id as count').first();
      if (Number(count.count) === 0) await rawDb.seed.run();
    }
    console.log(`✅ Base principal conectada: ${databaseMode === 'cloud' ? 'Turso Cloud' : 'SQLite local'}. Sin cambio automático de base.`);
  })();
  return initialization;
};

module.exports = {
  dbLocal,
  dbLocalDirect,
  dbCloudDirect,
  rawDb,
  requestContext,
  databaseMode,
  initializeDatabase,
  getActiveDb: () => {
    const store = requestContext ? requestContext.getStore() : null;
    if (store?.isOfflineContingency) {
      try {
        const helper = require('./contingencyDb');
        if (helper.isContingencyReady()) return helper.getContingencyDb();
      } catch {}
    }
    return rawDb;
  },
  isOnline: () => online,
  setOnlineStatus: (value) => { online = Boolean(value); },
  hasPendingLocalSync: () => pendingLocalSync,
  setPendingLocalSync: (value) => { pendingLocalSync = Boolean(value); },
  getLastSyncTime: () => lastSyncTime,
  setLastSyncTime: (value) => { lastSyncTime = value; },
  isNetworkError
};
