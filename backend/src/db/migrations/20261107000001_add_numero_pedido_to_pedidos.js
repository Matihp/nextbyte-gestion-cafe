exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('pedidos', 'numero_pedido');
  if (!hasCol) {
    await knex.schema.alterTable('pedidos', function (table) {
      table.integer('numero_pedido').nullable().defaultTo(1);
    });
  }

  // Poblar pedidos existentes secuencialmente por fecha (reinicio a las 00 hs / diario)
  const pedidosExistentes = await knex('pedidos')
    .select('id', 'fecha', 'hora', 'created_at')
    .orderBy('fecha', 'asc')
    .orderBy('hora', 'asc')
    .orderBy('created_at', 'asc');

  const conteoPorFecha = {};
  for (const p of pedidosExistentes) {
    const f = p.fecha || (p.created_at ? p.created_at.slice(0, 10) : 'default');
    conteoPorFecha[f] = ((conteoPorFecha[f] || 0) % 9999) + 1;
    await knex('pedidos')
      .where('id', p.id)
      .update({ numero_pedido: conteoPorFecha[f] });
  }
};

exports.down = function (knex) {
  return knex.schema.alterTable('pedidos', function (table) {
    table.dropColumn('numero_pedido');
  });
};

