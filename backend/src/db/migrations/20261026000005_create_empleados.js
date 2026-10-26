exports.up = function (knex) {
  return knex.schema.createTable('empleados', function (table) {
    table.string('id').primary();
    table.string('rol_id').nullable().references('id').inTable('roles').onDelete('SET NULL');
    table.string('legajo', 50).nullable().unique();
    table.string('nombre', 100).notNullable();
    table.string('apellido', 100).notNullable();
    table.string('email', 150).notNullable().unique();
    table.string('contrasena', 255).notNullable();
    table.string('telefono', 50).nullable();
    table.string('foto', 500).nullable();
    table.date('fecha_nacimiento').nullable();
    table.date('fecha_ingreso').nullable();
    table.string('turno_habitual', 50).nullable();
    table.json('dias_franco').nullable();
    table.json('permisos').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('empleados');
};
