const { dbLocal } = require('../config/db');
const recetaRepository = require('../repositories/recetaRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const insumoRepository = require('../repositories/insumoRepository');
const productoRepository = require('../repositories/productoRepository');
const AppError = require('../utils/AppError');
const { validarReceta, detectarRepetidos } = require('../dtos/receta.dto');

const getByProductoId = async (productoId) => {
  const producto = await productoRepository.getById(productoId);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const receta = await recetaRepository.getByProductoId(productoId);
  if (!receta) {
    return {
      producto_id: Number(productoId),
      nombre: null,
      ingredientes: []
    };
  }

  const ingredientes = await ingredienteRecetaRepository.getByRecetaId(receta.id);
  const insumos = await insumoRepository.getAll();
  const insumosMap = new Map(insumos.map((i) => [i.id, i]));

  const ingredientesFormateados = ingredientes.map((item) => {
    const insumo = insumosMap.get(item.insumo_id);
    return {
      insumo_id: item.insumo_id,
      insumo_nombre: insumo ? insumo.nombre : null,
      unidad_medida: insumo ? insumo.unidad_medida : null,
      cantidad: Number(item.cantidad)
    };
  });

  return {
    id: receta.id,
    producto_id: Number(productoId),
    nombre: receta.nombre,
    ingredientes: ingredientesFormateados
  };
};

const guardar = async (productoId, datos) => {
  const errores = validarReceta(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  return dbLocal.transaction(async (trx) => {
    const producto = await productoRepository.getById(productoId, trx);
    if (!producto) {
      throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
    }

    const insumosMap = new Map();
    for (const item of datos.ingredientes) {
      const insumo = await insumoRepository.getById(item.insumo_id, trx);
      if (!insumo) {
        throw new AppError(`El insumo ${item.insumo_id} no existe`, 404, 'NO_ENCONTRADO');
      }
      insumosMap.set(Number(item.insumo_id), insumo);
    }

    let receta = await recetaRepository.getByProductoId(productoId, trx);
    if (receta) {
      const resultado = await recetaRepository.update(
        receta.id,
        { nombre: datos.nombre.trim() },
        trx
      );
      receta = Array.isArray(resultado) ? resultado[0] : resultado;
      await ingredienteRecetaRepository.deleteByRecetaId(receta.id, trx);
    } else {
      const resultado = await recetaRepository.create(
        {
          producto_id: Number(productoId),
          nombre: datos.nombre.trim()
        },
        trx
      );
      receta = Array.isArray(resultado) ? resultado[0] : resultado;
    }

    const ingredientesPayload = datos.ingredientes.map((item) => ({
      receta_id: receta.id,
      insumo_id: Number(item.insumo_id),
      cantidad: Number(item.cantidad)
    }));

    await ingredienteRecetaRepository.createMany(ingredientesPayload, trx);

    const ingredientesFormateados = datos.ingredientes.map((item) => {
      const insumo = insumosMap.get(Number(item.insumo_id));
      return {
        insumo_id: Number(item.insumo_id),
        insumo_nombre: insumo ? insumo.nombre : null,
        unidad_medida: insumo ? insumo.unidad_medida : null,
        cantidad: Number(item.cantidad)
      };
    });

    return {
      id: receta.id,
      producto_id: Number(productoId),
      nombre: receta.nombre,
      ingredientes: ingredientesFormateados
    };
  });
};

const eliminar = async (productoId) => {
  const producto = await productoRepository.getById(productoId);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const receta = await recetaRepository.getByProductoId(productoId);
  if (!receta) {
    throw new AppError('La receta no existe', 404, 'NO_ENCONTRADO');
  }

  await recetaRepository.delete(receta.id);
  return { id: receta.id };
};

module.exports = {
  getByProductoId,
  guardar,
  eliminar,
  detectarRepetidos
};
