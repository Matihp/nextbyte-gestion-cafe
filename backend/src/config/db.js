const knex = require('knex');
const knexConfig = require('../../knexfile');

// Determinamos el entorno actual, por defecto 'development'
const environment = process.env.NODE_ENV || 'development';

// Instanciamos knex con la configuración SQLite local
const dbLocal = knex(knexConfig[environment]);

// Al arrancar, verificamos la base SQLite y ejecutamos migraciones y seeds automáticamente en desarrollo
if (environment !== 'test') {
  dbLocal.raw('SELECT 1')
    .then(async () => {
      console.log('✅ Archivo de Base de datos local (SQLite) verificado/creado con éxito');
      try {
        const [batchNo, log] = await dbLocal.migrate.latest();
        if (log && log.length > 0) {
          console.log(`📦 Base de datos migrada automáticamente (${log.length} migraciones aplicadas)`);
        }
        // Verificamos si la tabla roles está vacía para correr los seeds iniciales
        const tieneTablaRoles = await dbLocal.schema.hasTable('roles');
        if (tieneTablaRoles) {
          const countRoles = await dbLocal('roles').count('id as c').first();
          const total = Number(countRoles?.c || 0);
          if (total === 0) {
            console.log('🌱 Base de datos vacía: ejecutando seeds iniciales automáticos...');
            await dbLocal.seed.run();
            console.log('✅ Seeds iniciales cargados con éxito (Roles y Usuarios listos)');
          }
        }
      } catch (errMigracion) {
        console.error('❌ Error en auto-migración/seed de la Base de Datos:', errMigracion.message);
      }
    })
    .catch((err) => {
      console.error('❌ Error al iniciar la Base de Datos:', err);
    });
}

// NOTA PARA EL EQUIPO:
// Aca se configurará el cliente de Turso para la conexión online en un futuro cercano
// usando las variables: process.env.TURSO_DB_URL y process.env.TURSO_AUTH_TOKEN.
// Por ahora, todos pueden usar dbLocal en sus repositories para trabajar en su PC sin problemas.

module.exports = {
  dbLocal
};
