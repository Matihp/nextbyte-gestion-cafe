exports.up = async function (knex) {
  const safeCreateIndex = async (indexName, tableName, columns) => {
    try {
      const cols = Array.isArray(columns) ? columns.join(', ') : columns;
      await knex.raw(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${cols})`);
    } catch (e) {
      console.warn(`Index warning ${indexName}:`, e.message);
    }
  };

  // 1. Productos
  await safeCreateIndex('idx_productos_categoria_id', 'productos', ['categoria_id']);
  await safeCreateIndex('idx_productos_receta_id', 'productos', ['receta_id']);

  // 2. Recetas
  await safeCreateIndex('idx_recetas_producto_id', 'recetas', ['producto_id']);

  // 3. Registro Ventas
  await safeCreateIndex('idx_registro_ventas_fecha', 'registro_ventas', ['fecha']);

  // 4. Movimientos Caja
  await safeCreateIndex('idx_movimientos_caja_fecha', 'movimientos_caja', ['fecha']);
  await safeCreateIndex('idx_movimientos_caja_tipo', 'movimientos_caja', ['tipo']);

  // 5. Registros Mermas
  await safeCreateIndex('idx_registros_mermas_fecha', 'registros_mermas', ['fecha']);
  await safeCreateIndex('idx_registros_mermas_producto_id', 'registros_mermas', ['producto_id']);
  await safeCreateIndex('idx_registros_mermas_motivo', 'registros_mermas', ['motivo']);

  // 6. Pedidos
  await safeCreateIndex('idx_pedidos_tipo_pedido', 'pedidos', ['tipo_pedido']);
  await safeCreateIndex('idx_pedidos_metodo_pago', 'pedidos', ['metodo_pago']);
};

exports.down = async function (knex) {
  const safeDropIndex = async (indexName) => {
    try {
      await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
    } catch (_) {}
  };

  await safeDropIndex('idx_productos_categoria_id');
  await safeDropIndex('idx_productos_receta_id');
  await safeDropIndex('idx_recetas_producto_id');
  await safeDropIndex('idx_registro_ventas_fecha');
  await safeDropIndex('idx_movimientos_caja_fecha');
  await safeDropIndex('idx_movimientos_caja_tipo');
  await safeDropIndex('idx_registros_mermas_fecha');
  await safeDropIndex('idx_registros_mermas_producto_id');
  await safeDropIndex('idx_registros_mermas_motivo');
  await safeDropIndex('idx_pedidos_tipo_pedido');
  await safeDropIndex('idx_pedidos_metodo_pago');
};

