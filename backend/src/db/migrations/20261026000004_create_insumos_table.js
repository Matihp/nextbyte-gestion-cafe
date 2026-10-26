exports.up = function (knex) {
  return knex.schema.createTable("insumos", (table) => {
    table.increments("id").primary();

    table.string("proveedor_id").nullable().references("id").inTable("proveedores").onDelete("SET NULL");

    table.string("nombre");

    table.string("rubro");

    table.decimal("cantidad_disponible", 10, 3);

    table.string("unidad_medida");

    table.decimal("stock_minimo", 10, 3);

    table.decimal("precio_costo", 10, 2);

    table.datetime("ultima_actualizacion");

    table.date("fecha_ingreso");

    table.date("fecha_vencimiento");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("insumos");
};
