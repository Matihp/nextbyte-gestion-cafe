const fs = require('fs');
const path = require('path');
const knex = require('knex');
const knexConfig = require('../../knexfile');
const AppError = require('../utils/AppError');
const { applyEffectsToDatabase } = require('./operationJournalService');

const TABLAS_ORDENADAS = [
  'roles',
  'categorias',
  'proveedores',
  'insumos',
  'empleados',
  'recetas',
  'productos',
  'ingredientes_recetas',
  'turnos_empleados',
  'pedidos',
  'detalles_pedidos',
  'registro_ventas',
  'registros_mermas',
  'movimientos_caja'
];

async function executeBootstrap({
  sourceDb,
  targetDbPath,
  writerId,
  batchSize = 200
}) {
  if (!sourceDb) {
    throw new AppError('sourceDb es requerido para el bootstrap', 400, 'PARAMETRO_INVALIDO');
  }
  if (!targetDbPath) {
    throw new AppError('targetDbPath es requerido para el bootstrap', 400, 'PARAMETRO_INVALIDO');
  }

  const targetDir = path.dirname(targetDbPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const tempDbPath = `${targetDbPath}.tmp_${Date.now()}`;

  const writerStateBefore = await sourceDb('sync_writer_state').where({ id: 'global' }).first();
  const generationBefore = Number(writerStateBefore?.generation || 1);
  const headSeqBefore = Number(writerStateBefore?.head_seq || 0);
  const schemaVersionBefore = Number(writerStateBefore?.schema_version || 1);

  const tempKnex = knex({
    client: 'sqlite3',
    connection: { filename: tempDbPath },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;', cb);
      }
    },
    migrations: knexConfig.turso?.migrations || { directory: path.join(__dirname, '../db/migrations') }
  });

  const tableCounts = {};

  try {
    await tempKnex.migrate.latest();

    for (const tabla of TABLAS_ORDENADAS) {
      const existeEnSource = await sourceDb.schema.hasTable(tabla);
      if (!existeEnSource) continue;

      const hasId = await sourceDb.schema.hasColumn(tabla, 'id');
      let offset = 0;
      let totalCopiados = 0;

      while (true) {
        let query = sourceDb(tabla).limit(batchSize).offset(offset);
        if (hasId) {
          query = query.orderBy('id', 'asc');
        } else if (tabla === 'ingredientes_recetas') {
          query = query.orderBy('receta_id', 'asc').orderBy('insumo_id', 'asc');
        }

        const filas = await query;
        if (filas.length === 0) break;

        await tempKnex.transaction(async (trx) => {
          if (tabla === 'recetas') {
            const adaptadas = filas.map((r) => ({ ...r, producto_id: null }));
            await trx('recetas').insert(adaptadas);
          } else {
            await trx(tabla).insert(filas);
          }
        });

        totalCopiados += filas.length;
        offset += filas.length;
        if (filas.length < batchSize) break;
      }

      tableCounts[tabla] = totalCopiados;
    }

    const recetasConProducto = await sourceDb('recetas').whereNotNull('producto_id');
    if (recetasConProducto.length > 0) {
      await tempKnex.transaction(async (trx) => {
        for (const r of recetasConProducto) {
          await trx('recetas').where({ id: r.id }).update({ producto_id: r.producto_id });
        }
      });
    }

    const writerStateAfter = await sourceDb('sync_writer_state').where({ id: 'global' }).first();
    const headSeqAfter = Number(writerStateAfter?.head_seq || 0);
    const generationAfter = Number(writerStateAfter?.generation || 1);

    if (headSeqAfter !== headSeqBefore || generationAfter !== generationBefore) {
      throw new AppError(
        'Mutación concurrente detectada durante el snapshot; abortando bootstrap',
        409,
        'BOOTSTRAP_CONCURRENTE'
      );
    }

    const fkErrors = await tempKnex.raw('PRAGMA foreign_key_check');
    if (fkErrors && fkErrors.length > 0) {
      throw new AppError(
        `Violación de clave foránea detectada en snapshot: ${JSON.stringify(fkErrors)}`,
        500,
        'INTEGRIDAD_INVALIDA'
      );
    }

    const integrityResult = await tempKnex.raw('PRAGMA integrity_check');
    const integrityOk = integrityResult && integrityResult[0] && (
      integrityResult[0].integrity_check === 'ok' || integrityResult[0]['integrity_check'] === 'ok'
    );
    if (!integrityOk) {
      throw new AppError('Fallo de integridad SQLite en base temporal', 500, 'INTEGRIDAD_INVALIDA');
    }

    await tempKnex('contingency_state').insert({
      id: 'local',
      writer_id: writerId || writerStateBefore?.writer_id || 'wr_caja_principal',
      generation: generationBefore,
      last_cloud_seq_applied: headSeqBefore,
      last_head_acknowledged: headSeqBefore,
      bootstrap_status: 'READY',
      bootstrap_version: schemaVersionBefore,
      last_sync_at: tempKnex.fn.now()
    });

    await tempKnex.destroy();

    const backupPath = `${targetDbPath}.bak`;
    if (fs.existsSync(targetDbPath)) {
      try {
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        fs.renameSync(targetDbPath, backupPath);
      } catch {
      }
    }

    fs.renameSync(tempDbPath, targetDbPath);

    return {
      success: true,
      headSeq: headSeqBefore,
      generation: generationBefore,
      tableCounts
    };
  } catch (error) {
    try {
      await tempKnex.destroy();
    } catch {
    }
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
      }
    }
    throw error;
  }
}

async function applyIncrementalJournal({
  sourceDb,
  targetDb,
  batchLimit = 50,
  targetHead = null
}) {
  const localState = await targetDb('contingency_state').where({ id: 'local' }).first();
  if (!localState || localState.bootstrap_status !== 'READY') {
    throw new AppError('El espejo local no tiene un bootstrap válido completado', 400, 'BOOTSTRAP_REQUERIDO');
  }

  let finalTargetHead = targetHead;
  if (finalTargetHead === null || finalTargetHead === undefined) {
    const [writerState, maxOpRow] = await Promise.all([
      sourceDb('sync_writer_state').where({ id: 'global' }).first().catch(() => null),
      sourceDb('sync_operations').max('seq as max_seq').first().catch(() => null)
    ]);
    const writerHead = Number(writerState?.head_seq || 0);
    const opsHead = Number(maxOpRow?.max_seq || 0);
    finalTargetHead = Math.max(writerHead, opsHead);
  }

  let currentSeq = Number(localState.last_cloud_seq_applied || 0);
  let totalApplied = 0;

  while (currentSeq < finalTargetHead) {
    const pendingOps = await sourceDb('sync_operations')
      .where('seq', '>', currentSeq)
      .where('seq', '<=', finalTargetHead)
      .orderBy('seq', 'asc')
      .limit(batchLimit);

    if (pendingOps.length === 0) {
      if (currentSeq < finalTargetHead) {
        throw new AppError(
          `Salto inesperado de secuencia en journal cloud: esperado ${currentSeq + 1}, recibido vacio`,
          409,
          'SECUENCIA_INVALIDA'
        );
      }
      break;
    }

    for (const op of pendingOps) {
      const expectedSeq = currentSeq + 1;
      if (Number(op.seq) !== expectedSeq) {
        throw new AppError(
          `Salto inesperado de secuencia en journal cloud: esperado ${expectedSeq}, recibido ${op.seq}`,
          409,
          'SECUENCIA_INVALIDA'
        );
      }

      const effects = op.effects ? JSON.parse(op.effects) : [];

      await targetDb.transaction(async (trx) => {
        if (effects.length > 0) {
          await applyEffectsToDatabase(trx, effects);
        }

        await trx('contingency_state').where({ id: 'local' }).update({
          last_cloud_seq_applied: op.seq,
          last_head_acknowledged: op.seq,
          last_sync_at: trx.fn.now()
        });
      });

      currentSeq = Number(op.seq);
      totalApplied++;
    }
  }

  return {
    appliedCount: totalApplied,
    lastSeq: currentSeq
  };
}

module.exports = {
  TABLAS_ORDENADAS,
  executeBootstrap,
  applyIncrementalJournal
};
