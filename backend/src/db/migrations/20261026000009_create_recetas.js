exports.up = function (knex) {
  return knex.schema.createTable('recetas', function (table) {
    table.increments('id').primary();
    table.integer('producto_id').unsigned().notNullable().unique().references('id').inTable('productos').onDelete('CASCADE');
    table.string('nombre', 100).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('recetas');
};