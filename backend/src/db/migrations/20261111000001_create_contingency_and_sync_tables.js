exports.up = async function (knex) {
  const hasSyncWriterState = await knex.schema.hasTable('sync_writer_state');
  if (!hasSyncWriterState) {
    await knex.schema.createTable('sync_writer_state', function (table) {
      table.string('id', 50).primary();
      table.string('writer_id', 100).notNullable();
      table.integer('generation').unsigned().notNullable().defaultTo(1);
      table.integer('head_seq').unsigned().notNullable().defaultTo(0);
      table.integer('schema_version').unsigned().notNullable().defaultTo(1);
      table.timestamps(true, true);
    });
  }

  const hasSyncOperations = await knex.schema.hasTable('sync_operations');
  if (!hasSyncOperations) {
    await knex.schema.createTable('sync_operations', function (table) {
      table.increments('id').primary();
      table.string('operation_id', 128).notNullable().unique();
      table.integer('seq').unsigned().notNullable().unique();
      table.string('writer_id', 100).notNullable();
      table.integer('generation').unsigned().notNullable();
      table.string('actor_id', 100).nullable();
      table.string('operation_type', 50).notNullable();
      table.string('request_hash', 64).notNullable();
      table.string('effects_hash', 64).nullable();
      table.integer('payload_version').unsigned().notNullable().defaultTo(1);
      table.text('effects').nullable();
      table.text('result').nullable();
      table.timestamps(true, true);

      table.index(['writer_id', 'generation'], 'idx_sync_ops_writer_gen');
      table.index('created_at', 'idx_sync_ops_created_at');
    });
  }

  const hasContingencyState = await knex.schema.hasTable('contingency_state');
  if (!hasContingencyState) {
    await knex.schema.createTable('contingency_state', function (table) {
      table.string('id', 50).primary();
      table.string('writer_id', 100).notNullable();
      table.integer('generation').unsigned().notNullable().defaultTo(1);
      table.integer('last_cloud_seq_applied').unsigned().notNullable().defaultTo(0);
      table.integer('last_head_acknowledged').unsigned().notNullable().defaultTo(0);
      table.string('bootstrap_status', 30).notNullable().defaultTo('PENDING');
      table.integer('bootstrap_version').unsigned().notNullable().defaultTo(1);
      table.string('active_offline_session_id', 100).nullable();
      table.integer('offline_base_seq').unsigned().notNullable().defaultTo(0);
      table.timestamp('last_sync_at').nullable();
      table.timestamps(true, true);
    });
  }

  const hasOperationOutbox = await knex.schema.hasTable('operation_outbox');
  if (!hasOperationOutbox) {
    await knex.schema.createTable('operation_outbox', function (table) {
      table.increments('id').primary();
      table.string('operation_id', 128).notNullable().unique();
      table.integer('local_order').unsigned().notNullable();
      table.string('origin', 20).notNullable(); 
      table.string('actor_id', 100).nullable();
      table.string('operation_type', 50).notNullable();
      table.string('request_hash', 64).notNullable();
      table.text('request_payload').nullable();
      table.text('effects').nullable();
      table.string('effects_hash', 64).nullable();
      table.text('response_body').nullable();
      table.integer('response_status').notNullable().defaultTo(200);
      table.string('offline_session_id', 100).nullable();
      table.integer('base_cloud_seq').unsigned().notNullable().defaultTo(0);
      table.integer('base_generation').unsigned().notNullable().defaultTo(1);
      table.string('status', 20).notNullable().defaultTo('pending'); 
      table.integer('retry_count').unsigned().notNullable().defaultTo(0);
      table.string('last_error_code', 50).nullable();
      table.text('last_error_message').nullable();
      table.timestamps(true, true);

      table.index(['status', 'local_order'], 'idx_outbox_status_order');
      table.index('offline_session_id', 'idx_outbox_session');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('operation_outbox');
  await knex.schema.dropTableIfExists('contingency_state');
  await knex.schema.dropTableIfExists('sync_operations');
  await knex.schema.dropTableIfExists('sync_writer_state');
};

