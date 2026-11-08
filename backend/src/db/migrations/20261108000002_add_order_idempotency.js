exports.up = async function (knex) {
  await knex.schema.alterTable('pedidos', function (table) {
    table.string('idempotency_key', 128).nullable();
    table.string('idempotency_hash', 64).nullable();
    table.unique(['idempotency_key'], 'pedidos_idempotency_key_unique');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('pedidos', function (table) {
    table.dropUnique(['idempotency_key'], 'pedidos_idempotency_key_unique');
    table.dropColumn('idempotency_key');
    table.dropColumn('idempotency_hash');
  });
};
