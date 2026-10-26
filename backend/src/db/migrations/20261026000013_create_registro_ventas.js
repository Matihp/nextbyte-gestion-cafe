exports.up = function(knex) {
  return knex.schema.createTable('registro_ventas', function(table) {
    table.string('id').primary(); 
    
    table.string('pedido_id').notNullable().unique().references('id').inTable('pedidos').onDelete('CASCADE'); 
    
    table.date('fecha').notNullable(); 
    table.decimal('total_venta', 10, 2).notNullable();
    table.decimal('total_costo', 10, 2).notNullable();
    
    table.timestamps(true, true); 
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('registro_ventas');
};