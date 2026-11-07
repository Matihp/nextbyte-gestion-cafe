/**
 * Migración para la tabla de registro y cola de sincronización offline/online
 */
exports.up = async function (knex) {
  const existe = await knex.schema.hasTable('sync_pendientes');
  if (!existe) {
    await knex.schema.createTable('sync_pendientes', (table) => {
      table.increments('id').primary();
      table.string('tabla', 100).notNullable();
      table.string('registro_id', 100).notNullable();
      table.string('operacion', 20).notNullable().defaultTo('INSERT');
      table.text('datos').nullable();
      table.string('estado', 20).notNullable().defaultTo('pendiente');
      table.integer('intentos').notNullable().defaultTo(0);
      table.text('ultimo_error').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('sincronizado_at').nullable();

      table.index(['estado', 'tabla']);
      table.index(['tabla', 'registro_id']);
    });
  }
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('sync_pendientes');
};
