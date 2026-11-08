exports.config = { transaction: false };

const conFksDesactivadas = async (knex, fn) => {
  await knex.raw('PRAGMA foreign_keys = OFF');
  try {
    await fn();
  } finally {
    await knex.raw('PRAGMA foreign_keys = ON');
  }
};

exports.up = async function (knex) {
  await conFksDesactivadas(knex, async () => {
    // 1. Permitir producto_id nullable en recetas y eliminar índice único si existía
    await knex.raw('DROP INDEX IF EXISTS recetas_producto_id_unique');
    await knex.schema.alterTable('recetas', function (table) {
      table.integer('producto_id').unsigned().nullable().alter();
    });

    // 2. Agregar columna receta_id en productos si no existe
    const tieneRecetaId = await knex.schema.hasColumn('productos', 'receta_id');
    if (!tieneRecetaId) {
      await knex.schema.alterTable('productos', function (table) {
        table.integer('receta_id').unsigned().nullable().references('id').inTable('recetas').onDelete('SET NULL');
      });
    }
  });
};

exports.down = async function (knex) {
  await conFksDesactivadas(knex, async () => {
    const tieneRecetaId = await knex.schema.hasColumn('productos', 'receta_id');
    if (tieneRecetaId) {
      await knex.schema.alterTable('productos', function (table) {
        table.dropColumn('receta_id');
      });
    }
  });
};

