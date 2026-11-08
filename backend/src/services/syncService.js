const { dbLocalDirect, hasPendingLocalSync } = require('../config/db');
const AppError = require('../utils/AppError');

// Preserve the legacy queue for manual recovery. Never mark old work as synced
// merely because the row exists, and never copy an entire local DB over cloud.
const contarPendientes = async (db = dbLocalDirect) => {
  if (!db || !(await db.schema.hasTable('sync_pendientes'))) return 0;
  const result = await db('sync_pendientes').where({ estado: 'pendiente' }).count('id as count').first();
  return Number(result.count || 0);
};
const obtenerPendientes = async (limite = 200, db = dbLocalDirect) => {
  if (!db || !(await db.schema.hasTable('sync_pendientes'))) return [];
  return db('sync_pendientes').where({ estado: 'pendiente' }).orderBy('id').limit(limite);
};
const disabled = async () => {
  throw new AppError(
    'La sincronización automática está deshabilitada para proteger los datos. Los pendientes antiguos requieren revisión y migración manual.',
    409,
    'SYNC_DESHABILITADA'
  );
};

module.exports = {
  contarPendientes,
  obtenerPendientes,
  hayPendientes: async (db) => hasPendingLocalSync() || (await contarPendientes(db)) > 0,
  registrarCambio: disabled,
  reconciliarTablas: disabled,
  marcarSincronizado: disabled,
  marcarError: disabled
};
