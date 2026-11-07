const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
let Client_Libsql;
try {
  Client_Libsql = require('@libsql/knex-libsql');
} catch (e) {
  // Opcional en entornos sin driver libsql instalado
}

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.LOCAL_DB_PATH 
        ? path.resolve(__dirname, process.env.LOCAL_DB_PATH) 
        : path.join(__dirname, 'dev_local.db')
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'db', 'seeds')
    }
  },

  turso: {
    client: Client_Libsql,
    connection: {
      filename: process.env.TURSO_DB_URL
        ? `${process.env.TURSO_DB_URL}?authToken=${process.env.TURSO_AUTH_TOKEN || ''}`
        : path.join(__dirname, 'dev_local.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'db', 'seeds')
    }
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'test.db')
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', () => {
          conn.run('PRAGMA synchronous = OFF', () => {
            conn.run('PRAGMA journal_mode = MEMORY', cb);
          });
        });
      }
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    }
  },
  production: {
    client: 'sqlite3',
    connection: {
      filename: process.env.LOCAL_DB_PATH 
        ? path.resolve(__dirname, process.env.LOCAL_DB_PATH) 
        : path.join(__dirname, 'contingencia.db')
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    }
  }
};
