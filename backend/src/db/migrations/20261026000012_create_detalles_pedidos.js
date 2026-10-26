exports.up = function (knex) {
  return knex.schema.createTable('detalles_pedidos', function (table) {
    table.string('id').primary();
    table.string('pedido_id').notNullable().references('id').inTable('pedidos').onDelete('CASCADE');
    table.integer('producto_id').unsigned().notNullable().references('id').inTable('productos').onDelete('RESTRICT');
    table.string('nombre_producto', 150).notNullable();
    table.integer('cantidad').notNullable().defaultTo(1);
    table.decimal('precio_venta', 10, 2).notNullable();
    table.decimal('precio_costo', 10, 2).nullable().defaultTo(0.00);
    table.timestamps(true, true);

    table.index(['pedido_id']);
    table.index(['producto_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('detalles_pedidos');
};
