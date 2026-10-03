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
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'db', 'seeds')
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
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    }
  }
};
