const { dbLocal } = require('../config/db');
const TABLE = 'recetas';

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getById: (id) => dbLocal(TABLE).where({ id }).first(),
  getByProductoId: (productoId) => dbLocal(TABLE).where({ producto_id: productoId }).first(),
  create: (data) => dbLocal(TABLE).insert(data).returning('*'),
  update: (id, data) => dbLocal(TABLE).where({ id }).update(data).returning('*'),
  delete: (id) => dbLocal(TABLE).where({ id }).del(),
};