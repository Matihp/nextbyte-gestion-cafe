const AppError = require('../utils/AppError');
const { hashCanonicalPayload } = require('../utils/cryptoUtils');

const TABLAS_PERMITIDAS = new Set([
  'roles',
  'categorias',
  'proveedores',
  'insumos',
  'empleados',
  'turnos_empleados',
  'pedidos',
  'detalles_pedidos',
  'productos',
  'recetas',
  'ingredientes_recetas',
  'registros_mermas',
  'registro_ventas',
  'movimientos_caja'
]);

async function recordCloudOperation(trx, {
  operationId,
  actorId = null,
  writerId,
  generation = 1,
  operationType,
  requestHash,
  collector,
  result
}) {
  if (!operationId) {
    throw new AppError('operationId es obligatorio para el journal', 400, 'VALIDACION');
  }

  const existente = await trx('sync_operations').where({ operation_id: operationId }).first();
  if (existente) {
    if (existente.request_hash !== requestHash) {
      throw new AppError('La Idempotency-Key ya fue utilizada con otro payload', 409, 'IDEMPOTENCY_CONFLICT');
    }
    return {
      replay: true,
      seq: existente.seq,
      result: existente.result ? JSON.parse(existente.result) : null
    };
  }

  let writerState = await trx('sync_writer_state').where({ id: 'global' }).forUpdate().first();
  if (!writerState) {
    await trx('sync_writer_state').insert({
      id: 'global',
      writer_id: writerId,
      generation,
      head_seq: 0,
      schema_version: 1
    });
    writerState = await trx('sync_writer_state').where({ id: 'global' }).first();
  } else {
    if (writerState.writer_id !== writerId || Number(writerState.generation) !== Number(generation)) {
      throw new AppError(
        `Fencing rechazado: escritor ${writerId} (gen ${generation}) no coincide con el registrado ${writerState.writer_id} (gen ${writerState.generation})`,
        409,
        'WRITER_MISMATCH'
      );
    }
  }

  const newSeq = Number(writerState.head_seq) + 1;
  await trx('sync_writer_state').where({ id: 'global' }).update({
    head_seq: newSeq,
    updated_at: trx.fn.now()
  });

  const effects = collector ? collector.getEffects() : [];
  const effectsHash = collector ? collector.getEffectsHash() : null;

  await trx('sync_operations').insert({
    operation_id: operationId,
    seq: newSeq,
    writer_id: writerId,
    generation,
    actor_id: actorId,
    operation_type: operationType,
    request_hash: requestHash,
    effects_hash: effectsHash,
    payload_version: 1,
    effects: effects.length > 0 ? JSON.stringify(effects) : null,
    result: result !== undefined ? JSON.stringify(result) : null,
    created_at: trx.fn.now()
  });

  return {
    replay: false,
    seq: newSeq,
    effects,
    effectsHash
  };
}

async function recordOfflineOperation(trx, {
  operationId,
  actorId = null,
  offlineSessionId = null,
  baseCloudSeq = 0,
  baseGeneration = 1,
  operationType,
  requestHash,
  requestPayload = null,
  collector,
  result,
  status = 'pending'
}) {
  if (!operationId) {
    throw new AppError('operationId es obligatorio para la outbox', 400, 'VALIDACION');
  }

  const existente = await trx('operation_outbox').where({ operation_id: operationId }).first();
  if (existente) {
    if (existente.request_hash !== requestHash) {
      throw new AppError('La Idempotency-Key ya fue utilizada con otro payload', 409, 'IDEMPOTENCY_CONFLICT');
    }
    return {
      replay: true,
      localOrder: existente.local_order,
      result: existente.response_body ? JSON.parse(existente.response_body) : null
    };
  }

  const maxOrderRow = await trx('operation_outbox').max('local_order as max_order').first();
  const nextOrder = (Number(maxOrderRow?.max_order) || 0) + 1;

  const effects = collector ? collector.getEffects() : [];
  const effectsHash = collector ? collector.getEffectsHash() : null;

  await trx('operation_outbox').insert({
    operation_id: operationId,
    local_order: nextOrder,
    origin: 'offline',
    actor_id: actorId,
    operation_type: operationType,
    request_hash: requestHash,
    request_payload: requestPayload ? JSON.stringify(requestPayload) : null,
    effects: effects.length > 0 ? JSON.stringify(effects) : null,
    effects_hash: effectsHash,
    response_body: result !== undefined ? JSON.stringify(result) : null,
    response_status: 200,
    offline_session_id: offlineSessionId,
    base_cloud_seq: baseCloudSeq,
    base_generation: baseGeneration,
    status,
    retry_count: 0
  });

  return {
    replay: false,
    localOrder: nextOrder,
    effects,
    effectsHash
  };
}

async function applyEffectsToDatabase(targetTrx, effects = []) {
  if (!Array.isArray(effects) || effects.length === 0) return;

  for (const effect of effects) {
    const { table, op, id, data } = effect;
    if (!TABLAS_PERMITIDAS.has(table)) {
      throw new AppError(`Tabla no permitida en replicación de efectos: ${table}`, 400, 'TABLA_INVALIDA');
    }

    if (op === 'INSERT') {
      const existe = await targetTrx(table).where({ id }).first();
      if (!existe) {
        await targetTrx(table).insert(data);
      }
    } else if (op === 'UPDATE') {
      await targetTrx(table).where({ id }).update(data);
    } else if (op === 'DELETE') {
      await targetTrx(table).where({ id }).del();
    }
  }
}

module.exports = {
  TABLAS_PERMITIDAS,
  recordCloudOperation,
  recordOfflineOperation,
  applyEffectsToDatabase
};

