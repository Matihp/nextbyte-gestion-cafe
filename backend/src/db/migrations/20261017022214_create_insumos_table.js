exports.up = function (knex) {
  return knex.schema.createTable("insumos", (table) => {
    table.increments("id").primary();

    table
      .string("nombre", 150)
      .notNullable();

    table
      .string("categoria", 100)
      .notNullable();

    table
      .string("unidad", 50)
      .notNullable();

    table
      .decimal("stock_minimo", 12, 2)
      .notNullable()
      .defaultTo(0);

    table
      .boolean("activo")
      .notNullable()
      .defaultTo(true);

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
  return knex.schema.dropTableIfExists("insumos");
};
