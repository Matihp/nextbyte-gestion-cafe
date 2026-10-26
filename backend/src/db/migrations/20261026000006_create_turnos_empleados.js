exports.up = function (knex) {
  return knex.schema.createTable('turnos_empleados', function (table) {
    table.string('id').primary();
    table.string('empleado_id').notNullable().references('id').inTable('empleados').onDelete('CASCADE');
    table.date('fecha').notNullable();
    table.string('estado', 50).notNullable();
    table.timestamps(true, true);

    table.index(['empleado_id']);
    table.index(['fecha']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('turnos_empleados');
};
