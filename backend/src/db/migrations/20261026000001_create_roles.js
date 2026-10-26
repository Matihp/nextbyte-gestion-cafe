exports.up = function (knex) {
  return knex.schema.createTable('roles', function (table) {
    table.string('id').primary();
    table.string('nombre', 100).notNullable().unique();
    table.boolean('es_admin').notNullable().defaultTo(false);
    table.json('permisos').nullable();
    table.string('descripcion', 255).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('roles');
};
