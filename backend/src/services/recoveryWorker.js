const AppError = require('../utils/AppError');
const { getConnectivityService } = require('./connectivityService');
const { applyEffectsToDatabase } = require('./operationJournalService');
const { applyIncrementalJournal } = require('./bootstrapService');
const { MODOS_OPERATIVOS, CODIGOS_ERROR } = require('../constants/contingencia');
const { isNetworkError } = require('../config/databaseErrors');

async function replicarPedidoDesdeLocal(cloudTrx, localDb, item) {
  const pedidoId = item.operation_id;
  let pedidoLocal = null;
  let detallesLocales = [];

  if (localDb) {
    try {
      pedidoLocal = await localDb('pedidos').where({ id: pedidoId }).first();
      detallesLocales = await localDb('detalles_pedidos').where({ pedido_id: pedidoId });
    } catch {}
  }

  if (!pedidoLocal && item.response_body) {
    try {
      const parsed = JSON.parse(item.response_body);
      pedidoLocal = parsed;
      detallesLocales = parsed.detalles || [];
    } catch {}
  }

  if (!pedidoLocal) return;

  const existeEnCloud = await cloudTrx('pedidos').where({ id: pedidoId }).first();
  if (!existeEnCloud) {
    const { detalles, display_id, displayId, orderNumber, ...cabecera } = pedidoLocal;
    const cabeceraValida = {
      id: cabecera.id,
      cliente: cabecera.cliente,
      total: Number(cabecera.total || 0),
      estado: cabecera.estado,
      tipo_pedido: cabecera.tipo_pedido,
      metodo_pago: cabecera.metodo_pago,
      direccion: cabecera.direccion || null,
      telefono: cabecera.telefono || null,
      fecha: cabecera.fecha,
      hora: cabecera.hora,
      numero_pedido: cabecera.numero_pedido || null,
      idempotency_key: cabecera.idempotency_key || null,
      idempotency_hash: cabecera.idempotency_hash || null,
      created_at: cabecera.created_at || cloudTrx.fn.now(),
      updated_at: cabecera.updated_at || cloudTrx.fn.now()
    };
    await cloudTrx('pedidos').insert(cabeceraValida);
  }

  if (Array.isArray(detallesLocales)) {
    for (const det of detallesLocales) {
      const existeDetalle = await cloudTrx('detalles_pedidos').where({ id: det.id }).first();
      if (!existeDetalle) {
        await cloudTrx('detalles_pedidos').insert({
          id: det.id,
          pedido_id: pedidoId,
          producto_id: det.producto_id || null,
          nombre_producto: det.nombre_producto,
          cantidad: Number(det.cantidad || 1),
          precio_venta: Number(det.precio_venta || 0),
          precio_costo: Number(det.precio_costo || 0),
          created_at: det.created_at || cloudTrx.fn.now(),
          updated_at: det.updated_at || cloudTrx.fn.now()
        });

        if (det.producto_id) {
          try {
            await cloudTrx('productos')
              .where({ id: det.producto_id })
              .decrement('stock_actual', Number(det.cantidad || 1));
          } catch {}
        }
      }
    }
  }
}

class RecoveryWorker {
  constructor() {
    this.isRunning = false;
    this.activePromise = null;
  }

  runRecovery({ localDb, cloudDb, writerId, generation = 1 }) {
    if (this.isRunning && this.activePromise) {
      return this.activePromise;
    }

    this.isRunning = true;
    this.activePromise = this._execute({ localDb, cloudDb, writerId, generation })
      .finally(() => {
        this.isRunning = false;
        this.activePromise = null;
      });

    return this.activePromise;
  }

  async _execute({ localDb, cloudDb, writerId, generation }) {
    const connectivity = getConnectivityService();
    connectivity.mode = MODOS_OPERATIVOS.RECOVERING;
    connectivity.reason = 'RECONCILIANDO_CONTINGENCIA';

    let processedCount = 0;

    try {
      const pendientes = await localDb('operation_outbox')
        .whereIn('status', ['pending', 'sending', 'uncertain'])
        .orderBy('local_order', 'asc');

      for (const item of pendientes) {
        await localDb('operation_outbox').where({ id: item.id }).update({
          status: 'sending',
          updated_at: localDb.fn.now()
        });

        const effects = item.effects ? JSON.parse(item.effects) : [];
        let cloudSeq = null;

        try {
          await cloudDb.transaction(async (cloudTrx) => {
            const existente = await cloudTrx('sync_operations').where({ operation_id: item.operation_id }).first();
            if (existente) {
              if (existente.request_hash !== item.request_hash) {
                throw new AppError('Hash divergente en replay de operación', 409, CODIGOS_ERROR.SYNC_CONFLICT);
              }
              if (item.operation_type === 'CREAR_PEDIDO') {
                await replicarPedidoDesdeLocal(cloudTrx, localDb, item);
              }
              cloudSeq = existente.seq;
              return;
            }

            const writerState = await cloudTrx('sync_writer_state').where({ id: 'global' }).forUpdate().first();
            let newSeq = 1;
            if (writerState) {
              if (writerState.writer_id !== writerId || Number(writerState.generation) !== Number(generation)) {
                throw new AppError(
                  `Fencing cloud no coincide: esperado ${writerId} (gen ${generation}), actual ${writerState.writer_id} (gen ${writerState.generation})`,
                  409,
                  CODIGOS_ERROR.WRITER_MISMATCH
                );
              }
              newSeq = (Number(writerState.head_seq) || 0) + 1;
              await cloudTrx('sync_writer_state').where({ id: 'global' }).update({
                head_seq: newSeq,
                updated_at: cloudTrx.fn.now()
              });
            } else {
              await cloudTrx('sync_writer_state').insert({
                id: 'global',
                writer_id: writerId,
                generation,
                head_seq: 1,
                schema_version: 1,
                created_at: cloudTrx.fn.now()
              });
            }

            if (effects.length > 0) {
              await applyEffectsToDatabase(cloudTrx, effects);
            } else if (item.operation_type === 'CREAR_PEDIDO') {
              await replicarPedidoDesdeLocal(cloudTrx, localDb, item);
            } else if (item.operation_type === 'CAMBIAR_ESTADO_COMANDA' || item.operation_type === 'COMPLETAR_PEDIDO' || item.operation_type === 'ENTREGAR_PEDIDO') {
              let pedidoId = item.operation_id;
              let nuevoEstado = null;
              if (item.request_payload) {
                try {
                  const payload = JSON.parse(item.request_payload);
                  pedidoId = payload.id || pedidoId;
                  nuevoEstado = payload.nuevoEstado || (item.operation_type === 'ENTREGAR_PEDIDO' ? 'entregado' : item.operation_type === 'COMPLETAR_PEDIDO' ? 'completado' : null);
                } catch {}
              }
              if (pedidoId && nuevoEstado) {
                await cloudTrx('pedidos').where({ id: pedidoId }).update({
                  estado: nuevoEstado,
                  updated_at: cloudTrx.fn.now()
                });
              }
            }

            await cloudTrx('sync_operations').insert({
              operation_id: item.operation_id,
              seq: newSeq,
              writer_id: writerId,
              generation,
              actor_id: item.actor_id,
              operation_type: item.operation_type,
              request_hash: item.request_hash,
              effects_hash: item.effects_hash,
              payload_version: 1,
              effects: item.effects,
              result: item.response_body,
              created_at: cloudTrx.fn.now()
            });

            cloudSeq = newSeq;
          });
        } catch (cloudErr) {
          if (isNetworkError(cloudErr)) {
            await localDb('operation_outbox').where({ id: item.id }).update({
              status: 'uncertain',
              last_error_code: 'RED_INTERRUMPIDA',
              last_error_message: cloudErr.message,
              updated_at: localDb.fn.now()
            });
            connectivity.mode = MODOS_OPERATIVOS.BLOCKED_UNSAFE;
            connectivity.reason = CODIGOS_ERROR.OPERATION_UNCERTAIN;
            return {
              success: false,
              code: 'REPLAY_INTERRUMPIDO',
              message: 'Conexión interrumpida durante la reconciliación; reintento programado.',
              processedCount
            };
          }

          await localDb('operation_outbox').where({ id: item.id }).update({
            status: 'conflict',
            last_error_code: cloudErr.code || 'ERROR_INTEGRIDAD',
            last_error_message: cloudErr.message,
            updated_at: localDb.fn.now()
          });
          connectivity.mode = MODOS_OPERATIVOS.BLOCKED_UNSAFE;
          connectivity.reason = CODIGOS_ERROR.SYNC_CONFLICT;
          throw cloudErr;
        }

        await localDb.transaction(async (localTrx) => {
          await localTrx('operation_outbox').where({ id: item.id }).update({
            status: 'acknowledged',
            updated_at: localTrx.fn.now()
          });

          await localTrx('contingency_state').where({ id: 'local' }).update({
            last_cloud_seq_applied: cloudSeq,
            last_head_acknowledged: cloudSeq,
            last_sync_at: localTrx.fn.now()
          });
        });

        processedCount++;
      }

      await applyIncrementalJournal({ sourceDb: cloudDb, targetDb: localDb });

      await localDb('contingency_state').where({ id: 'local' }).update({
        active_offline_session_id: null,
        last_sync_at: localDb.fn.now()
      });

      connectivity.setLocalMirrorState({
        ready: true,
        pendingCount: 0,
        uncertainCount: 0
      });
      connectivity.mode = MODOS_OPERATIVOS.ONLINE;
      connectivity.reason = null;
      connectivity.reportCloudSuccess();
      try {
        const { setOnlineStatus } = require('../config/db');
        setOnlineStatus(true);
      } catch {}

      return {
        success: true,
        processedCount,
        message: 'Sincronización completada exitosamente.'
      };
    } catch (error) {
      connectivity.mode = MODOS_OPERATIVOS.BLOCKED_UNSAFE;
      connectivity.reason = error.code || CODIGOS_ERROR.SYNC_CONFLICT;
      throw error;
    }
  }
}

let defaultWorker = null;

function getRecoveryWorker() {
  if (!defaultWorker) {
    defaultWorker = new RecoveryWorker();
  }
  return defaultWorker;
}

module.exports = {
  RecoveryWorker,
  getRecoveryWorker
};
