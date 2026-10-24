exports.up = function (knex) {
  return knex.schema.createTable("insumos", (table) => {
    table.integer("id").primary();

    table.string("nombre");

    table.string("rubro");

    table.decimal("cantidad_disponible");

    table.string("unidad_medida");

    table.decimal("stock_minimo");

    table.decimal("precio_costo");

    table.datetime("ultima_actualizacion");

    table.date("fecha_ingreso");

    table.date("fecha_vencimiento");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("insumos");
};
