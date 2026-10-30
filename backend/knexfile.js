const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
