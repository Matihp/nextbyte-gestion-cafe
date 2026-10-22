exports.up = function (knex) {
  return knex.schema.createTable('categorias', function (table) {
    table.increments('id').primary();
    table.string('nombre', 100).notNullable().unique();
    table.string('icono', 500).nullable(); // Guardará el nombre del archivo de imagen local
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('categorias');
};