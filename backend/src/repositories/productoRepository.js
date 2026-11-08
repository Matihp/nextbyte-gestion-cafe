const { dbLocal } = require('../config/db');
const TABLE = 'productos';

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

const getBaseDetailsQuery = (trx = null) => {
  const db = trx || dbLocal;
  return db('productos as p')
    .leftJoin('categorias as c', 'p.categoria_id', 'c.id')
    .leftJoin('recetas as r', function () {
      this.on(function () {
        this.on(function () {
          this.onNotNull('p.receta_id').andOn('r.id', '=', 'p.receta_id');
        }).orOn(function () {
          this.onNull('p.receta_id').andOn('r.producto_id', '=', 'p.id');
        });
      });
    })
    .leftJoin('ingredientes_recetas as ir', 'ir.receta_id', 'r.id')
    .leftJoin('insumos as i', 'ir.insumo_id', 'i.id')
    .select(
      'p.*',
      'c.nombre as categoria_nombre',
      db.raw('ROUND(COALESCE(SUM(ir.cantidad * i.precio_costo), 0), 2) as precio_costo')
    )
    .groupBy('p.id');
};

module.exports = {
  getAll: () => dbLocal(TABLE).orderBy('nombre'),
  getAllWithDetails: (categoriaId = null, trx = null) => {
    let q = getBaseDetailsQuery(trx).orderBy('p.nombre', 'asc');
    if (categoriaId) {
      q = q.where('p.categoria_id', Number(categoriaId));
    }
    return q;
  },
  getById: (id, trx = null) => consulta(trx).where({ id }).first(),
  getByIdWithDetails: (id, trx = null) => getBaseDetailsQuery(trx).where('p.id', id).first(),
  getByCategoria: (categoriaId) => dbLocal(TABLE).where({ categoria_id: categoriaId }).orderBy('nombre'),
  create: (data) => dbLocal(TABLE).insert(data).returning('*'),
  update: (id, data) => dbLocal(TABLE).where({ id }).update(data).returning('*'),
  delete: (id) => dbLocal(TABLE).where({ id }).del(),
  updateStock: (id, cantidad, trx = null) => consulta(trx).where({ id }).increment('stock_actual', cantidad).returning('*'),
};
