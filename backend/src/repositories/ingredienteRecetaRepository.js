const { dbLocal } = require('../config/db');

const TABLE = 'ingredientes_recetas';

module.exports = {
  getByRecetaId: (recetaId) => dbLocal(TABLE).where({ receta_id: recetaId }),
  
  create: (data) => dbLocal(TABLE).insert(data),
  
  createMany: (dataArray) => dbLocal(TABLE).insert(dataArray),
  
  deleteByRecetaId: (recetaId) => 
    dbLocal(TABLE).where({ receta_id: recetaId }).del(),
  
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