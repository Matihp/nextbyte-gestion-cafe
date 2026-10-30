const { dbLocal } = require('../config/db');

const TABLE = 'ingredientes_recetas';

const consulta = (trx) => (trx ? trx(TABLE) : dbLocal(TABLE));

module.exports = {
  getByRecetaId: (recetaId, trx = null) => consulta(trx).where({ receta_id: recetaId }),

  getByInsumoId: (insumoId, trx = null) => consulta(trx).where({ insumo_id: insumoId }),
  
  create: (data) => dbLocal(TABLE).insert(data),
  
  createMany: (dataArray, trx = null) => consulta(trx).insert(dataArray),
  
  deleteByRecetaId: (recetaId, trx = null) => 
    consulta(trx).where({ receta_id: recetaId }).del(),
  
  updateCantidad: (recetaId, insumoId, cantidad) => 
    dbLocal(TABLE)
      .where({ receta_id: recetaId, insumo_id: insumoId })
      .update({ cantidad })
      .returning('*'),
  
  delete: (recetaId, insumoId) => 
    dbLocal(TABLE)
      .where({ receta_id: recetaId, insumo_id: insumoId })
      .del(),
};