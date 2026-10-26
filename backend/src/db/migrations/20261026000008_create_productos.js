exports.up = function (knex) {
  return knex.schema.createTable('productos', function (table) {
    table.increments('id').primary();
    table.integer('categoria_id').unsigned().notNullable().references('id').inTable('categorias').onDelete('RESTRICT');
    table.string('nombre', 100).notNullable();
    table.decimal('precio_venta', 10, 2).notNullable();
    table.integer('stock_actual').defaultTo(0);
    table.string('imagen', 500).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('productos');
};