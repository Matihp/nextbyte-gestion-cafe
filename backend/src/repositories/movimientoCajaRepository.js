const crypto = require('crypto');
const { dbLocal } = require('../config/db');

const TABLE = 'movimientos_caja';
const MERMAS_TABLE = 'registros_mermas';
const MOTIVOS_MERMA = [
  'VENCIDO',
  'MERMA',
  'EN FALTA',
  'Vencido',
  'Merma',
  'En falta',
  'En Falta',
  'Producto Vencido',
  'PRODUCTO VENCIDO'
];

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getAll: (filtros = {}, trx = null) => {
    const query = consulta(trx).select('*');

    if (filtros.fecha) query.where('fecha', filtros.fecha);
    if (filtros.desde) query.where('fecha', '>=', filtros.desde);
    if (filtros.hasta) query.where('fecha', '<=', filtros.hasta);

    return query.orderBy('fecha', 'desc').orderBy('hora', 'desc');
  },

  getById: (id, trx = null) => consulta(trx).where({ id }).first(),

  create: async (data, trx = null) => {
    const payload = {
      id: crypto.randomUUID(),
      fecha: data.fecha,
      hora: data.hora,
      tipo: data.tipo,
      detalle: data.detalle.trim(),
      monto: Number(data.monto),
      usuario_id: data.usuario_id || null,
      updated_at: dbLocal.fn.now(),
    };

    await consulta(trx).insert(payload);
    return module.exports.getById(payload.id, trx);
  },

  delete: (id, trx = null) => consulta(trx).where({ id }).del(),

  getSaldoTotal: async (trx = null) => {
    const pedidosQ = trx ? trx('pedidos') : dbLocal('pedidos');
    const ventaRes = await pedidosQ
      .whereIn('estado', ['completado', 'entregado'])
      .select(dbLocal.raw('COALESCE(SUM(total), 0) as total_ventas'))
      .first();

    const movRes = await consulta(trx)
      .select(dbLocal.raw(`
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0) as total_movimientos
      `))
      .first();

    const totalVentas = Number(ventaRes?.total_ventas) || 0;
    const totalMovs = Number(movRes?.total_movimientos) || 0;
    return {
      saldo: totalVentas + totalMovs,
      total_ventas: totalVentas,
      total_movimientos: totalMovs,
    };
  },

  getSaldoAntesDeMes: (mes, trx = null) =>
    consulta(trx)
      .where('fecha', '<', `${mes}-01`)
      .select(dbLocal.raw(`
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0) as saldo
      `))
      .first(),

  getMermasMes: (mes) =>
    dbLocal(MERMAS_TABLE)
      .whereIn('motivo', MOTIVOS_MERMA)
      .whereRaw(`strftime('%Y-%m', fecha) = ?`, [mes])
      .select('*')
      .orderBy('fecha', 'desc'),
};
