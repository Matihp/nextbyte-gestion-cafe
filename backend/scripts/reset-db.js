/**
 * Deja la base de desarrollo desde cero: borra dev_local.db, corre las migraciones
 * y, si existe un seed local, lo ejecuta. Uso: npm run reset-db
 */
const fs = require('fs');
const path = require('path');
const knex = require('knex');
const knexConfig = require('../knexfile');

const config = knexConfig.development;

const tieneSeed = () => {
  const carpeta = config.seeds.directory;
  return fs.existsSync(carpeta) && fs.readdirSync(carpeta).some((archivo) => archivo.endsWith('.js'));
};

const main = async () => {
  const archivo = config.connection.filename;

  if (fs.existsSync(archivo)) {
    try {
      fs.unlinkSync(archivo);
      console.log(`🗑️  Base borrada: ${path.basename(archivo)}`);
    } catch (error) {
      console.error('❌ No se pudo borrar la base. ¿Está abierto el servidor (npm run dev) o DBeaver? Cerralo y reintentá.');
      process.exit(1);
    }
  }

  const db = knex(config);
  try {
    const [, migraciones] = await db.migrate.latest();
    console.log(`✅ Migraciones aplicadas: ${migraciones.length}`);

    if (tieneSeed()) {
      await db.seed.run();
      console.log('✅ Seed local ejecutado');
    } else {
      console.log('ℹ️  No hay seed local: la base quedó vacía');
    }
  } finally {
    await db.destroy();
  }
};

main().catch((error) => {
  console.error('❌ Error al reiniciar la base:', error.message);
  process.exit(1);
});
