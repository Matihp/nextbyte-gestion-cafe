const { dbLocal } = require('../config/db');
const TABLE = 'productos';

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getById: (id) => dbLocal(TABLE).where({ id }).first(),
  getByCategoria: (categoriaId) => dbLocal(TABLE).where({ categoria_id: categoriaId }).orderBy('nombre'),
  create: (data) => dbLocal(TABLE).insert(data).returning('*'),
  update: (id, data) => dbLocal(TABLE).where({ id }).update(data).returning('*'),
  delete: (id) => dbLocal(TABLE).where({ id }).del(),
  updateStock: (id, cantidad) => dbLocal(TABLE).where({ id }).increment('stock_actual', cantidad).returning('*'),
};