const knex = require('knex');
const knexConfig = require('../../knexfile');

// Determinamos el entorno actual, por defecto 'development'
const environment = process.env.NODE_ENV || 'development';

// Instanciamos knex con la configuración SQLite local
const dbLocal = knex(knexConfig[environment]);

// Al arrancar, hacemos una mini-consulta para forzar a SQLite a crear el archivo .db fisicamente
dbLocal.raw('SELECT 1').then(() => {
  console.log('✅ Archivo de Base de datos local (SQLite) verificado/creado con éxito');
}).catch((err) => {
  console.error('❌ Error al iniciar la Base de Datos:', err);
});

// NOTA PARA EL EQUIPO:
// Aca se configurará el cliente de Turso para la conexión online en un futuro cercano
// usando las variables: process.env.TURSO_DB_URL y process.env.TURSO_AUTH_TOKEN.
// Por ahora, todos pueden usar dbLocal en sus repositories para trabajar en su PC sin problemas.

module.exports = {
  dbLocal
};
