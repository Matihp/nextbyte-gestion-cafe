exports.up = function (knex) {
  return knex.schema.createTable("registros_mermas", (table) => {
    table.string("id").primary();
    table.string("producto_id");
    table.string("nombre_producto");
    table.string("nombre_categoria");
    table.string("motivo");
    table.date("fecha");
    table.decimal("cantidad", 10, 2).nullable().defaultTo(1);
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("registros_mermas");
};
