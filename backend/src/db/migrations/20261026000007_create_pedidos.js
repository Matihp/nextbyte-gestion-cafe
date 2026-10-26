exports.up = function (knex) {
  return knex.schema.createTable('pedidos', function (table) {
    table.string('id').primary();
    table.string('cliente', 150).nullable().defaultTo('Consumidor Final');
    table.decimal('total', 10, 2).notNullable().defaultTo(0.00);
    table.string('estado', 50).notNullable().defaultTo('pendiente');
    table.string('tipo_pedido', 50).notNullable().defaultTo('salon');
    table.string('metodo_pago', 50).nullable();
    table.string('direccion', 255).nullable();
    table.string('telefono', 50).nullable();
    table.date('fecha').nullable();
    table.string('hora', 20).nullable();
    table.timestamps(true, true);

    table.index(['estado']);
    table.index(['fecha']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('pedidos');
};
