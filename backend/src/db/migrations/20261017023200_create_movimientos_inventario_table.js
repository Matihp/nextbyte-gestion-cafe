exports.up = function (knex) {
  return knex.schema.createTable(
    "movimientos_inventario",
    (table) => {
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
        .integer("lote_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("lotes")
        .onUpdate("CASCADE")
        .onDelete("RESTRICT");

      table
        .string("tipo", 20)
        .notNullable();

      table
        .decimal("cantidad", 12, 2)
        .notNullable();

      table
        .string("motivo", 255)
        .nullable();

      table
        .timestamp("fecha")
        .notNullable()
        .defaultTo(knex.fn.now());

      table
        .timestamp("created_at")
        .notNullable()
        .defaultTo(knex.fn.now());
    }
  );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists(
    "movimientos_inventario"
  );
};
