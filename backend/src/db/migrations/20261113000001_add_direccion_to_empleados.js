exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('empleados', 'direccion');
  if (!hasCol) {
    await knex.schema.table('empleados', function (table) {
      table.string('direccion', 255).nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasCol = await knex.schema.hasColumn('empleados', 'direccion');
  if (hasCol) {
    await knex.schema.table('empleados', function (table) {
      table.dropColumn('direccion');
    });
  }
};

