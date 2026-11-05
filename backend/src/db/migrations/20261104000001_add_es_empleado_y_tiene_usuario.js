exports.up = async function (knex) {
  const hasEsEmpleado = await knex.schema.hasColumn('empleados', 'es_empleado');
  if (!hasEsEmpleado) {
    await knex.schema.table('empleados', function (table) {
      table.boolean('es_empleado').notNullable().defaultTo(true);
    });
  }

  const hasTieneUsuario = await knex.schema.hasColumn('empleados', 'tiene_usuario');
  if (!hasTieneUsuario) {
    await knex.schema.table('empleados', function (table) {
      table.boolean('tiene_usuario').notNullable().defaultTo(true);
    });
  }
};

exports.down = function (knex) {
  return knex.schema.table('empleados', function (table) {
    table.dropColumn('es_empleado');
    table.dropColumn('tiene_usuario');
  });
};

