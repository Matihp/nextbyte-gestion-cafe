/**
 * Script de migración segura de datos: dev_local.db -> Turso Cloud
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const knex = require('knex');
const knexConfig = require('../knexfile');
const { reconciliarTablas } = require('../src/services/syncService');

async function migrarDatosATurso() {
  console.log('====================================================');
  console.log('🚀 MIGRACIÓN SEGURA DE DATOS: SQLite Local -> Turso Cloud');
  console.log('====================================================\n');

  if (!process.env.TURSO_DB_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Error: Faltan las variables TURSO_DB_URL o TURSO_AUTH_TOKEN en .env');
    process.exit(1);
  }

  const dbLocal = knex(knexConfig.development);
  const dbTurso = knex(knexConfig.turso);

  try {
    console.log('📡 Verificando conexión con SQLite local...');
    await dbLocal.raw('SELECT 1');
    console.log('   ✅ Conexión con SQLite local exitosa.');

    console.log('📡 Verificando conexión con Turso Cloud...');
    await dbTurso.raw('SELECT 1');
    console.log('   ✅ Conexión con Turso Cloud exitosa.\n');
    console.log('📦 Verificando migraciones en Turso Cloud...');
    const [, migraciones] = await dbTurso.migrate.latest();
    if (migraciones && migraciones.length > 0) {
      console.log(`   ✅ Se aplicaron ${migraciones.length} migraciones pendientes en Turso.`);
    } else {
      console.log('   ℹ️  Todas las migraciones ya estaban aplicadas en Turso.\n');
    }

    console.log('📋 Iniciando reconciliación y migración de datos topológica...');
    const resultado = await reconciliarTablas(dbLocal, dbTurso);

    console.log('\n====================================================');
    console.log('🎉 RESUMEN DE MIGRACIÓN COMPLETADO CON ÉXITO:');
    console.log('====================================================');
    for (const [tabla, stats] of Object.entries(resultado.detalles)) {
      console.log(
        `  • ${tabla.padEnd(22)}: Local=${String(stats.total).padStart(2)} | Migrados/Sync=${String(stats.sincronizados).padStart(2)} | Existían=${String(stats.existentes).padStart(2)}`
      );
    }
    console.log(`\n✨ Total de registros sincronizados a Turso Cloud: ${resultado.totalSincronizados}`);
    console.log('====================================================');

    return resultado;
  } catch (error) {
    console.error('❌ Error durante la migración a Turso Cloud:', error);
    process.exit(1);
  } finally {
    await dbLocal.destroy();
    await dbTurso.destroy();
  }
}

if (require.main === module) {
  migrarDatosATurso()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrarDatosATurso };
