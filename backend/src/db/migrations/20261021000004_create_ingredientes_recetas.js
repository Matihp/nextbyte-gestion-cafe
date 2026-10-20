exports.up = function (knex) {
  return knex.schema.createTable('ingredientes_recetas', function (table) {
    table.integer('receta_id').unsigned().notNullable(); // FK suelta (Fase A)
    table.integer('insumo_id').unsigned().notNullable(); // FK suelta (Fase A - Lucas)
    table.decimal('cantidad', 10, 3).notNullable();
    
    // PK Compuesta
    table.primary(['receta_id', 'insumo_id']);
    
    // Índices para búsquedas rápidas
    table.index(['receta_id']);
    table.index(['insumo_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ingredientes_recetas');
};