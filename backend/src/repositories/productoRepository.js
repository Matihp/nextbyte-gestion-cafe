const { dbLocal } = require('../config/db');
const TABLE = 'productos';

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getById: (id, trx = null) => consulta(trx).where({ id }).first(),
  getByCategoria: (categoriaId) => dbLocal(TABLE).where({ categoria_id: categoriaId }).orderBy('nombre'),
  create: (data) => dbLocal(TABLE).insert(data).returning('*'),
  update: (id, data) => dbLocal(TABLE).where({ id }).update(data).returning('*'),
  delete: (id) => dbLocal(TABLE).where({ id }).del(),
  updateStock: (id, cantidad, trx = null) => consulta(trx).where({ id }).increment('stock_actual', cantidad).returning('*'),
};