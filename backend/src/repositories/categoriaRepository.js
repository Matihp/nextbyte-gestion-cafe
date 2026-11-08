const { dbLocal } = require('../config/db');
const TABLE = 'categorias';

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getById: (id, trx = null) => consulta(trx).where({ id }).first(),
  getByNombre: (nombre, excludeId = null) => {
    if (!nombre) return Promise.resolve(null);
    let q = dbLocal(TABLE).whereRaw('LOWER(TRIM(nombre)) = LOWER(TRIM(?))', [nombre]);
    if (excludeId) {
      q = q.whereNot('id', Number(excludeId));
    }
    return q.first();
  },
  hasProductos: async (categoriaId) => {
    const row = await dbLocal('productos').where({ categoria_id: categoriaId }).first('id');
    return Boolean(row);
  },
  create: (data) => dbLocal(TABLE).insert(data).returning('*'),
  update: (id, data) => dbLocal(TABLE).where({ id }).update(data).returning('*'),
  delete: (id) => dbLocal(TABLE).where({ id }).del(),
};