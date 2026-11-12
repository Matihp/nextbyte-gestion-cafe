const { dbLocal } = require('../config/db');
const { getConnectivityService } = require('./connectivityService');
const { EffectCollector } = require('./effectCollector');
const { recordCloudOperation, recordOfflineOperation, applyEffectsToDatabase } = require('./operationJournalService');
const { hashCanonicalPayload, generarUUID } = require('../utils/cryptoUtils');
const { MODOS_OPERATIVOS, CODIGOS_ERROR } = require('../constants/contingencia');
const AppError = require('../utils/AppError');

async function runBusinessMutation({
  db = dbLocal,
  localDb = null,
  operationId = null,
  actorId = null,
  operationType,
  payload = null,
  execute
}) {
  const connectivity = getConnectivityService();
  const state = connectivity.getState();
  const isContingencyActive = Boolean(state.syncEnabled);

  if (!isContingencyActive) {
    return db.transaction(async (trx) => {
      const ctx = {
        db,
        trx,
        collector: null,
        isOffline: false,
        operationId: operationId || generarUUID()
      };
      return execute(ctx);
    });
  }

  const effectiveOpId = operationId || generarUUID();
  const requestHash = hashCanonicalPayload({
    actorId,
    operationType,
    payload
  });

  if (state.mode === MODOS_OPERATIVOS.OFFLINE_ACTIVE) {
    if (!state.localReady) {
      throw new AppError('La base local de contingencia no está lista para operar', 503, CODIGOS_ERROR.OFFLINE_NOT_READY);
    }

    return db.transaction(async (trx) => {
      const existente = await trx('operation_outbox').where({ operation_id: effectiveOpId }).first();
      if (existente) {
        if (existente.request_hash !== requestHash) {
          throw new AppError('La Idempotency-Key ya fue utilizada con otro payload', 409, 'IDEMPOTENCY_CONFLICT');
        }
        return existente.response_body ? JSON.parse(existente.response_body) : null;
      }

      const collector = new EffectCollector();
      const ctx = {
        db,
        trx,
        collector,
        isOffline: true,
        operationId: effectiveOpId
      };

      const result = await execute(ctx);

      await recordOfflineOperation(trx, {
        operationId: effectiveOpId,
        actorId,
        offlineSessionId: state.activeOfflineSessionId || 'sesion_offline',
        baseCloudSeq: state.lastCloudSeq || 0,
        baseGeneration: state.generation || 1,
        operationType,
        requestHash,
        requestPayload: payload,
        collector,
        result,
        status: 'pending'
      });

      // Actualizar contador de pendientes en el servicio de estado
      connectivity.setLocalMirrorState({
        ready: true,
        pendingCount: (state.pendingCount || 0) + 1,
        uncertainCount: state.uncertainCount,
        lastCloudSeq: state.lastCloudSeq
      });

      return result;
    });
  }

  if (state.mode === MODOS_OPERATIVOS.ONLINE || state.databaseMode === 'test') {
    const collector = new EffectCollector();

    let result;
    let cloudSeq = 0;

    try {
      result = await db.transaction(async (trx) => {
        const existente = await trx('sync_operations').where({ operation_id: effectiveOpId }).first();
        if (existente) {
          if (existente.request_hash !== requestHash) {
            throw new AppError('La Idempotency-Key ya fue utilizada con otro payload', 409, 'IDEMPOTENCY_CONFLICT');
          }
          return existente.result ? JSON.parse(existente.result) : null;
        }

        const ctx = {
          db,
          trx,
          collector,
          isOffline: false,
          operationId: effectiveOpId
        };

        const execResult = await execute(ctx);

        const journalResult = await recordCloudOperation(trx, {
          operationId: effectiveOpId,
          actorId,
          writerId: state.writerId || 'wr_caja_principal',
          generation: state.generation || 1,
          operationType,
          requestHash,
          collector,
          result: execResult
        });

        cloudSeq = journalResult.seq;
        return execResult;
      });

      connectivity.reportCloudSuccess();
    } catch (error) {
      await connectivity.reportCloudFailure(error);
      throw error;
    }

    if (localDb && collector.getEffects().length > 0) {
      try {
        await localDb.transaction(async (localTrx) => {
          await applyEffectsToDatabase(localTrx, collector.getEffects());
          await localTrx('contingency_state').where({ id: 'local' }).update({
            last_cloud_seq_applied: cloudSeq,
            updated_at: localTrx.fn.now()
          });
        });
      } catch (mirrorError) {
        connectivity.setLocalMirrorState({
          ready: false,
          reason: 'ERROR_ESPEJO_LOCAL',
          pendingCount: state.pendingCount,
          uncertainCount: state.uncertainCount,
          lastCloudSeq: cloudSeq
        });
      }
    }

    return result;
  }

  throw new AppError(
    `Operación rechazada: el sistema se encuentra en modo ${state.mode}`,
    503,
    state.reason || CODIGOS_ERROR.CLOUD_UNAVAILABLE
  );
}

module.exports = {
  runBusinessMutation
};
