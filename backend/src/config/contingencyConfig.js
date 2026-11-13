const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROLES_APP } = require('../constants/contingencia');

function parseContingencyConfig(env = process.env, dbMode = null) {
  const isContingencyEnabled = env.CONTINGENCY_ENABLED === 'true';
  const appRole = env.APP_ROLE || ROLES_APP.CAJA_PRINCIPAL;

  if (!Object.values(ROLES_APP).includes(appRole)) {
    throw new Error(`APP_ROLE inválido: ${appRole}. Debe ser ${ROLES_APP.CAJA_PRINCIPAL} o ${ROLES_APP.SECUNDARIA}`);
  }

  const effectiveDbMode = dbMode || env.DB_MODE || (env.TURSO_DB_URL && env.TURSO_AUTH_TOKEN ? 'cloud' : 'local');

  if (isContingencyEnabled) {
    if (env.NODE_ENV !== 'test') {
      if (effectiveDbMode !== 'cloud') {
        throw new Error('CONTINGENCY_ENABLED=true requiere DB_MODE=cloud (no se permite con local independiente)');
      }
      if (appRole !== ROLES_APP.CAJA_PRINCIPAL) {
        throw new Error('CONTINGENCY_ENABLED=true requiere APP_ROLE=CAJA_PRINCIPAL');
      }
    }
  }

  const dbPath = env.LOCAL_DB_PATH ? path.resolve(env.LOCAL_DB_PATH) : path.resolve('./data/contingencia.db');
  const dataDir = path.dirname(dbPath);
  const writerId = env.WRITER_ID || (isContingencyEnabled ? 'caja_principal' : null);

  const probeUrls = env.INTERNET_PROBE_URLS
    ? env.INTERNET_PROBE_URLS.split(',').map((u) => u.trim()).filter(Boolean)
    : ['https://cloudflare.com/cdn-cgi/trace', 'https://connectivitycheck.gstatic.com/generate_204'];

  return {
    isContingencyEnabled,
    appRole,
    effectiveDbMode,
    writerId,
    dbPath,
    dataDir,
    probeUrls,
    idleProbeIntervalMs: Number(env.IDLE_PROBE_INTERVAL_MS || 8000),
    probeTimeoutMs: Number(env.PROBE_TIMEOUT_MS || 3000),
    probeRetryDelayMs: Number(env.PROBE_RETRY_DELAY_MS || 2000)
  };
}

module.exports = {
  parseContingencyConfig
};

