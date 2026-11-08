const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const LibsqlKnexClient = require('./src/config/libsqlKnexClient');

const migrations = { directory: path.join(__dirname, 'src', 'db', 'migrations') };
const seeds = { directory: path.join(__dirname, 'src', 'db', 'seeds') };
const localConfig = (filename) => ({
  client: 'sqlite3',
  connection: {
    filename: process.env.LOCAL_DB_PATH ? path.resolve(__dirname, process.env.LOCAL_DB_PATH) : path.join(__dirname, filename)
  },
  useNullAsDefault: true,
  pool: {
    min: 1,
    max: 1,
    afterCreate(conn, cb) {
      conn.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;', (error) => cb(error, conn));
    }
  },
  migrations,
  seeds
});

module.exports = {
  development: localConfig('dev_local.db'),
  production: localConfig('contingencia.db'),
  turso: {
    client: LibsqlKnexClient,
    connection: {
      filename: ':memory:',
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      requestTimeoutMs: Number(process.env.TURSO_REQUEST_TIMEOUT_MS || 5000)
    },
    useNullAsDefault: true,
    acquireConnectionTimeout: 10000,
    pool: { min: 0, max: 4, idleTimeoutMillis: 30000 },
    migrations,
    seeds
  },
  test: {
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(conn, cb) {
        conn.run('PRAGMA foreign_keys = ON', (error) => cb(error, conn));
      }
    },
    migrations
  }
};
