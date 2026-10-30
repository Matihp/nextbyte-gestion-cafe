const { dbLocal } = require('../config/db');
const TABLE = 'recetas';

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getById: (id, trx = null) => consulta(trx).where({ id }).first(),
  getByProductoId: (productoId, trx = null) => consulta(trx).where({ producto_id: productoId }).first(),
  create: (data, trx = null) => consulta(trx).insert(data).returning('*'),
  update: (id, data, trx = null) => consulta(trx).where({ id }).update(data).returning('*'),
  delete: (id, trx = null) => consulta(trx).where({ id }).del(),
};