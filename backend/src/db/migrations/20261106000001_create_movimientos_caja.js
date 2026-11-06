exports.up = async (knex) => {
  const exists = await knex.schema.hasTable('movimientos_caja');
  if (!exists) {
    await knex.schema.createTable('movimientos_caja', (table) => {
      table.string('id').primary();
      table.string('fecha').notNullable();
      table.string('hora').notNullable();
      table.string('tipo').notNullable();
      table.string('detalle').notNullable();
      table.float('monto').notNullable();
      table.string('usuario_id').nullable().references('id').inTable('empleados').onDelete('SET NULL');
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.datetime('updated_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = (knex) => knex.schema.dropTableIfExists('movimientos_caja');

