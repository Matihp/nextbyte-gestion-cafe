const { dbLocal } = require('../config/db');
const TABLE = 'categorias';

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getById: (id, trx = null) => consulta(trx).where({ id }).first(),
  create: (data) => dbLocal(TABLE).insert(data).returning('*'),
  update: (id, data) => dbLocal(TABLE).where({ id }).update(data).returning('*'),
  delete: (id) => dbLocal(TABLE).where({ id }).del(),
};