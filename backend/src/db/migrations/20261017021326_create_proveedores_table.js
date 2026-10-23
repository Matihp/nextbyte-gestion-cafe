exports.up = function (knex) {
  return knex.schema.createTable("proveedores", (table) => {
    table.increments("id").primary();

    table
      .string("codigo", 20)
      .notNullable()
      .unique();

    table
      .string("empresa", 150)
      .notNullable();

    table
      .string("contacto", 120)
      .notNullable();

    table
      .string("rubro", 100)
      .notNullable();

    table
      .string("email", 150)
      .notNullable();

    table
      .string("telefono", 50)
      .notNullable();

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
  return knex.schema.dropTableIfExists("proveedores");
};
