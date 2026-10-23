exports.up = function (knex) {
  return knex.schema.createTable("lotes", (table) => {
    table.increments("id").primary();

    table
      .integer("insumo_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("insumos")
      .onUpdate("CASCADE")
      .onDelete("RESTRICT");

    table
      .integer("proveedor_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("proveedores")
      .onUpdate("CASCADE")
      .onDelete("RESTRICT");

    table
      .decimal("cantidad", 12, 2)
      .notNullable();

    table
      .decimal("costo_unitario", 12, 2)
      .notNullable();

    table
      .date("fecha_ingreso")
      .notNullable();

    table
      .date("fecha_vencimiento")
      .nullable();

    table
      .string("estado", 20)
      .notNullable()
      .defaultTo("activo");

    table
      .timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("lotes");
};
