const { dbLocal } = require('../../src/config/db');

/**
 * Deja la base de test vacía y con todas las tablas creadas.
 * Usar en beforeAll de cada archivo de test de integración.
 */
const resetDb = async () => {
  await dbLocal.migrate.rollback({}, true);
  await dbLocal.migrate.latest();
};

const closeDb = async () => {
  await dbLocal.destroy();
};

module.exports = { dbLocal, resetDb, closeDb };
