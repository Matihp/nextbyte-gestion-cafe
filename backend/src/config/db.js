const knex = require('knex');
const knexConfig = require('../../knexfile');

// Determinamos el entorno actual, por defecto 'development'
const environment = process.env.NODE_ENV || 'development';

let dbTest = null;
let dbLocalDirect = null;
let dbCloudDirect = null;

const hasTurso = Boolean(process.env.TURSO_DB_URL && process.env.TURSO_AUTH_TOKEN);
let isOnlineState = environment !== 'test' && hasTurso;
let pendingLocalSync = false;
let lastSyncTime = null;
let isSyncTrackingEnabled = false;

const TABLAS_DOMINIO = [
  'roles',
  'categorias',
  'proveedores',
  'insumos',
  'empleados',
  'turnos_empleados',
  'productos',
  'recetas',
  'ingredientes_recetas',
  'registros_mermas',
  'pedidos',
  'detalles_pedidos',
  'registro_ventas',
  'movimientos_caja'
];

function isNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || err.cause?.code || err.cause?.errno || '').toUpperCase();
  const name = err.name || '';
  const causeName = err.cause?.name || '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    name === 'FetchError' ||
    name === 'ClosedError' ||
    name === 'HttpError' ||
    causeName === 'FetchError' ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('socket') ||
    msg.includes('connection') ||
    msg.includes('hang up') ||
    msg.includes('stream is closed') ||
    msg.includes('closederror') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('libsql')
  );
}

if (environment === 'test') {
  dbTest = knex(knexConfig.test);
} else {
  dbLocalDirect = knex(knexConfig[environment] || knexConfig.development);
  if (hasTurso) {
    dbCloudDirect = knex(knexConfig.turso);
  }

  dbLocalDirect.on('query-response', async (response, obj, builder) => {
    if (!isSyncTrackingEnabled) return;
    const table = builder._single?.table;
    if (!table || table === 'sync_pendientes' || table.startsWith('knex_')) return;
    if (!TABLAS_DOMINIO.includes(table)) return;

    const method = (obj.method || '').toLowerCase();
    if (!['insert', 'update', 'del', 'delete'].includes(method)) return;

    // Solo registramos si estamos operando en modo local (offline o con sync pendiente)
    if (isOnlineState && !pendingLocalSync && dbCloudDirect) return;

    try {
      const records = [];
      if (method === 'insert') {
        const rawInsert = builder._single?.insert;
        if (Array.isArray(rawInsert)) {
          rawInsert.forEach((item, idx) => {
            const id = item.id || (Array.isArray(response) ? response[idx] || response[0] : null);
            if (id) records.push({ id: String(id), datos: item, operacion: 'INSERT' });
          });
        } else if (rawInsert && typeof rawInsert === 'object') {
          const id = rawInsert.id || (Array.isArray(response) ? response[0] : null);
          if (id) records.push({ id: String(id), datos: rawInsert, operacion: 'INSERT' });
        }
      } else if (method === 'update') {
        const whereId = builder._statements?.find((s) => s.grouping === 'where' && s.column === 'id');
        const id = whereId?.value ? String(whereId.value) : null;
        if (id) records.push({ id, datos: builder._single?.update, operacion: 'UPDATE' });
      } else if (method === 'del' || method === 'delete') {
        const whereId = builder._statements?.find((s) => s.grouping === 'where' && s.column === 'id');
        const id = whereId?.value ? String(whereId.value) : null;
        if (id) records.push({ id, datos: null, operacion: 'DELETE' });
      }

      for (const rec of records) {
        await dbLocalDirect('sync_pendientes').insert({
          tabla: table,
          registro_id: rec.id,
          operacion: rec.operacion,
          datos: rec.datos ? JSON.stringify(rec.datos) : null,
          estado: 'pendiente',
          intentos: 0,
          created_at: new Date().toISOString()
        });
        pendingLocalSync = true;
      }
    } catch {
  
      pendingLocalSync = true;
    }
  });
}

function getActiveDb() {
  if (environment === 'test') {
    return dbTest;
  }
  if (isOnlineState && !pendingLocalSync && dbCloudDirect) {
    return dbCloudDirect;
  }
  return dbLocalDirect;
}

const dbLocal = new Proxy(function () {}, {
  apply(target, thisArg, argArray) {
    const active = getActiveDb();
    const qb = active.apply(active, argArray);

    
    if (active === dbCloudDirect) {
      return new Proxy(qb, {
        get(qbTarget, qbProp) {
          if (qbProp === 'then') {
            return function (resolve, reject) {
              return qbTarget.then(resolve, async (err) => {
                if (isNetworkError(err)) {
                  
                  try {
                    const { sql, bindings } = qbTarget.toSQL();
                    const retryRes = await dbCloudDirect.raw(sql, bindings);
                    const finalRes = qbTarget._single?.first && Array.isArray(retryRes) ? (retryRes[0] || null) : retryRes;
                    return resolve(finalRes);
                  } catch (retryErr) {
                   
                    console.warn('⚠️ Fallo de red con Turso Cloud en query. Redirigiendo a SQLite local:', retryErr.message);
                    isOnlineState = false;
                    pendingLocalSync = true;
                    try {
                      const { sql, bindings } = qbTarget.toSQL();
                      const fallbackRes = await dbLocalDirect.raw(sql, bindings);
                      const finalRes = qbTarget._single?.first && Array.isArray(fallbackRes) ? (fallbackRes[0] || null) : fallbackRes;
                      return resolve(finalRes);
                    } catch (fallbackErr) {
                      return reject(fallbackErr);
                    }
                  }
                }
                return reject(err);
              });
            };
          }
          const val = qbTarget[qbProp];
          if (typeof val === 'function') {
            return val.bind(qbTarget);
          }
          return val;
        }
      });
    }

    return qb;
  },
  get(target, prop) {
    if (prop === 'dbLocalDirect') return dbLocalDirect;
    if (prop === 'dbCloudDirect') return dbCloudDirect;
    if (prop === 'getActiveDb') return getActiveDb;
    if (prop === 'isOnline') return () => isOnlineState;
    if (prop === 'setOnlineStatus') return (val) => { isOnlineState = Boolean(val); };
    if (prop === 'hasPendingLocalSync') return () => pendingLocalSync;
    if (prop === 'setPendingLocalSync') return (val) => { pendingLocalSync = Boolean(val); };
    if (prop === 'getLastSyncTime') return () => lastSyncTime;
    if (prop === 'setLastSyncTime') return (val) => { lastSyncTime = val; };
    if (prop === 'habilitarSyncTracking') return () => { isSyncTrackingEnabled = true; };
    if (prop === 'deshabilitarSyncTracking') return () => { isSyncTrackingEnabled = false; };

    if (prop === 'transaction') {
      return async function (...args) {
        const active = getActiveDb();
        if (active === dbCloudDirect) {
          try {
            return await active.transaction(...args);
          } catch (err) {
            if (isNetworkError(err)) {
              console.warn('⚠️ Fallo de conexión con Turso Cloud durante transacción. Pasando a SQLite local:', err.message);
              isOnlineState = false;
              pendingLocalSync = true;
              return await dbLocalDirect.transaction(...args);
            }
            throw err;
          }
        }
        return await active.transaction(...args);
      };
    }

    const active = getActiveDb();
    const value = active[prop];
    if (typeof value === 'function') {
      return value.bind(active);
    }
    return value;
  }
});

if (environment !== 'test') {
  (async () => {
    // 1. Inicializar SQLite local
    try {
      await dbLocalDirect.raw('SELECT 1');
      console.log('✅ Base de datos local (SQLite) conectada');
      const [, logLocal] = await dbLocalDirect.migrate.latest();
      if (logLocal && logLocal.length > 0) {
        console.log(`📦 SQLite local: ${logLocal.length} migraciones aplicadas`);
      }
      const hasRoles = await dbLocalDirect.schema.hasTable('roles');
      if (hasRoles) {
        const countRoles = await dbLocalDirect('roles').count('id as c').first();
        if (Number(countRoles?.c || 0) === 0) {
          await dbLocalDirect.seed.run();
          console.log('🌱 SQLite local: seeds iniciales cargados');
        }
      }

      // Verificamos si quedaron registros pendientes de una sesión offline previa
      const hasSyncTable = await dbLocalDirect.schema.hasTable('sync_pendientes');
      if (hasSyncTable) {
        const countPendientes = await dbLocalDirect('sync_pendientes')
          .where({ estado: 'pendiente' })
          .count('id as c')
          .first();
        const num = Number(countPendientes?.c || 0);
        if (num > 0) {
          pendingLocalSync = true;
          console.log(`⏳ SQLite local: se detectaron ${num} registros pendientes de sincronizar con Turso Cloud.`);
        }
      }

      // Una vez inicializadas migraciones y seeds, activamos la captura de operaciones locales
      isSyncTrackingEnabled = true;
    } catch (errLocal) {
      console.error('❌ Error al inicializar SQLite local:', errLocal.message);
    }

    // 2. Inicializar Turso Cloud si está configurado
    if (dbCloudDirect) {
      try {
        await dbCloudDirect.raw('SELECT 1');
        console.log('✅ Conexión con Turso Cloud (libSQL online) verificada con éxito');
        const [, logCloud] = await dbCloudDirect.migrate.latest();
        if (logCloud && logCloud.length > 0) {
          console.log(`📦 Turso Cloud: ${logCloud.length} migraciones aplicadas`);
        }
        isOnlineState = true;
      } catch (errCloud) {
        console.warn('⚠️ No se pudo conectar con Turso Cloud al iniciar. Activando modo contingencia offline (SQLite local):', errCloud.message);
        isOnlineState = false;
      }
    } else {
      isOnlineState = false;
    }
  })();
}

module.exports = {
  dbLocal,
  dbLocalDirect,
  dbCloudDirect,
  getActiveDb,
  isOnline: () => isOnlineState,
  setOnlineStatus: (val) => { isOnlineState = Boolean(val); },
  hasPendingLocalSync: () => pendingLocalSync,
  setPendingLocalSync: (val) => { pendingLocalSync = Boolean(val); },
  getLastSyncTime: () => lastSyncTime,
  setLastSyncTime: (val) => { lastSyncTime = val; },
  isNetworkError,
  habilitarSyncTracking: () => { isSyncTrackingEnabled = true; },
  deshabilitarSyncTracking: () => { isSyncTrackingEnabled = false; }
};
