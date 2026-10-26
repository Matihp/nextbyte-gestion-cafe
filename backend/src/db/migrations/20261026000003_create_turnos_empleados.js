exports.up = function (knex) {
  return knex.schema.createTable('turnos_empleados', function (table) {
    table.string('id').primary();
    table.string('empleado_id').notNullable();
    table.date('fecha').notNullable();
    table.string('estado', 50).notNullable();
    table.string('hora_entrada', 10).nullable();
    table.string('hora_salida', 10).nullable();
    table.boolean('es_excepcional').notNullable().defaultTo(false);
    table.text('observaciones').nullable();
    table.timestamps(true, true);

    table.index(['empleado_id']);
    table.index(['fecha']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('turnos_empleados');
};
