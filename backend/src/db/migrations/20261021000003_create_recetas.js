exports.up = function (knex) {
  return knex.schema.createTable('recetas', function (table) {
    table.increments('id').primary();
    table.integer('producto_id').unsigned().notNullable().unique(); // FK suelta (Fase A)
    table.string('nombre', 100).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('recetas');
};