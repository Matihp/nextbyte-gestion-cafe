exports.up = function(knex) {
  return knex.schema.createTable('registro_ventas', function(table) {
    table.string('id').primary(); 
    
    // REGLA DE ORO FASE A: Columna suelta, SIN .references()
    table.string('pedido_id').notNullable(); 
    
    table.datetime('fecha_venta').notNullable(); 
    table.float('total_venta').notNullable();
    table.float('total_costo').notNullable();
    
    table.timestamps(true, true); 
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('registro_ventas');
};