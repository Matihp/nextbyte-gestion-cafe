exports.up = function (knex) {
  return knex.schema.createTable("proveedores", (table) => {
    table.string("id").primary();

    table.string("codigo");

    table.string("empresa");

    table.string("nombre_contacto");

    table.string("apellido_contacto");

    table.string("telefono");

    table.string("email");

    table.string("rubro");

    table.json("insumos_asignados_ids");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("proveedores");
};
