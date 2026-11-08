const { dbLocal } = require('../config/db');
const recetaRepository = require('../repositories/recetaRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const insumoRepository = require('../repositories/insumoRepository');
const productoRepository = require('../repositories/productoRepository');
const AppError = require('../utils/AppError');
const { validarReceta, detectarRepetidos } = require('../dtos/receta.dto');

const mapearIngredientes = (ingredientes = []) => {
  let costoTotal = 0;
  const lista = ingredientes.map((item) => {
    const pCosto = Number(item.precio_costo || 0);
    const subtotal = Number((pCosto * Number(item.cantidad || 0)).toFixed(2));
    costoTotal += subtotal;
    return {
      insumo_id: Number(item.insumo_id),
      insumo_nombre: item.insumo_nombre || null,
      unidad_medida: item.unidad_medida || null,
      precio_costo: pCosto,
      cantidad: Number(item.cantidad || 0),
      subtotal_costo: subtotal
    };
  });
  return { lista, costoTotal: Number(costoTotal.toFixed(2)) };
};

const getAll = async () => {
  const recetas = await recetaRepository.getAll();
  if (!recetas || recetas.length === 0) return [];

  const todosIngredientes = await ingredienteRecetaRepository.getAllWithDetails();

  const ingPorReceta = new Map();
  for (const item of todosIngredientes) {
    const recId = Number(item.receta_id);
    if (!ingPorReceta.has(recId)) {
      ingPorReceta.set(recId, []);
    }
    ingPorReceta.get(recId).push(item);
  }

  return recetas.map((r) => {
    const ings = ingPorReceta.get(Number(r.id)) || [];
    const { lista, costoTotal } = mapearIngredientes(ings);
    return {
      id: r.id,
      producto_id: r.producto_id,
      nombre: r.nombre,
      costo_total: costoTotal,
      ingredientes: lista
    };
  });
};

const getById = async (id) => {
  const receta = await recetaRepository.getById(id);
  if (!receta) {
    throw new AppError('Receta no encontrada', 404, 'NO_ENCONTRADO');
  }

  const ingredientes = await ingredienteRecetaRepository.getByRecetaIdWithDetails(receta.id);
  const { lista, costoTotal } = mapearIngredientes(ingredientes);

  return {
    id: receta.id,
    producto_id: receta.producto_id,
    nombre: receta.nombre,
    costo_total: costoTotal,
    ingredientes: lista
  };
};

const getByProductoId = async (productoId) => {
  const producto = await productoRepository.getById(productoId);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  let receta = null;
  if (producto.receta_id) {
    receta = await recetaRepository.getById(producto.receta_id);
  }
  if (!receta) {
    receta = await recetaRepository.getByProductoId(productoId);
  }

  if (!receta) {
    return {
      producto_id: Number(productoId),
      nombre: null,
      ingredientes: []
    };
  }

  const ingredientes = await ingredienteRecetaRepository.getByRecetaIdWithDetails(receta.id);
  const { lista, costoTotal } = mapearIngredientes(ingredientes);

  return {
    id: receta.id,
    producto_id: Number(productoId),
    nombre: receta.nombre,
    costo_total: costoTotal,
    ingredientes: lista
  };
};

const crearReceta = async (datos) => {
  const errores = validarReceta(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  return dbLocal.transaction(async (trx) => {
    const insumoIds = datos.ingredientes.map((item) => Number(item.insumo_id));
    const insumos = await insumoRepository.getByIds(insumoIds, trx);
    const insumosSet = new Set(insumos.map((i) => Number(i.id)));
    for (const item of datos.ingredientes) {
      if (!insumosSet.has(Number(item.insumo_id))) {
        throw new AppError(`El insumo ${item.insumo_id} no existe`, 404, 'NO_ENCONTRADO');
      }
    }

    const resultado = await recetaRepository.create(
      {
        producto_id: datos.producto_id ? Number(datos.producto_id) : null,
        nombre: datos.nombre.trim()
      },
      trx
    );
    const receta = Array.isArray(resultado) ? resultado[0] : resultado;
    const recetaId = receta.id || (await trx('recetas').where({ nombre: datos.nombre.trim() }).orderBy('id', 'desc').first())?.id;

    const ingredientesPayload = datos.ingredientes.map((item) => ({
      receta_id: recetaId,
      insumo_id: Number(item.insumo_id),
      cantidad: Number(item.cantidad)
    }));

    await ingredienteRecetaRepository.createMany(ingredientesPayload, trx);
    const ingredientesGuardados = await ingredienteRecetaRepository.getByRecetaIdWithDetails(recetaId, trx);
    const { lista, costoTotal } = mapearIngredientes(ingredientesGuardados);

    return {
      id: recetaId,
      producto_id: datos.producto_id ? Number(datos.producto_id) : null,
      nombre: datos.nombre.trim(),
      costo_total: costoTotal,
      ingredientes: lista
    };
  });
};

const guardar = async (idOrProductoId, datos) => {
  const errores = validarReceta(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  return dbLocal.transaction(async (trx) => {
    // Buscar si corresponde a una receta existente por ID
    let receta = await recetaRepository.getById(idOrProductoId, trx);
    let esPorProducto = false;

    if (!receta) {
      // Si no es ID de receta, buscar si es producto_id
      const producto = await productoRepository.getById(idOrProductoId, trx);
      if (producto) {
        esPorProducto = true;
        receta = await recetaRepository.getByProductoId(idOrProductoId, trx);
      }
    }

    const insumoIds = datos.ingredientes.map((item) => Number(item.insumo_id));
    const insumos = await insumoRepository.getByIds(insumoIds, trx);
    const insumosSet = new Set(insumos.map((i) => Number(i.id)));
    for (const item of datos.ingredientes) {
      if (!insumosSet.has(Number(item.insumo_id))) {
        throw new AppError(`El insumo ${item.insumo_id} no existe`, 404, 'NO_ENCONTRADO');
      }
    }

    if (receta) {
      await recetaRepository.update(
        receta.id,
        { nombre: datos.nombre.trim() },
        trx
      );
      await ingredienteRecetaRepository.deleteByRecetaId(receta.id, trx);
    } else {
      const resultado = await recetaRepository.create(
        {
          producto_id: esPorProducto ? Number(idOrProductoId) : null,
          nombre: datos.nombre.trim()
        },
        trx
      );
      receta = Array.isArray(resultado) ? resultado[0] : resultado;
      if (!receta?.id) {
        receta = await trx('recetas').where({ nombre: datos.nombre.trim() }).orderBy('id', 'desc').first();
      }
    }

    const ingredientesPayload = datos.ingredientes.map((item) => ({
      receta_id: receta.id,
      insumo_id: Number(item.insumo_id),
      cantidad: Number(item.cantidad)
    }));

    await ingredienteRecetaRepository.createMany(ingredientesPayload, trx);
    const ingredientesGuardados = await ingredienteRecetaRepository.getByRecetaIdWithDetails(receta.id, trx);
    const { lista, costoTotal } = mapearIngredientes(ingredientesGuardados);

    return {
      id: receta.id,
      producto_id: receta.producto_id || (esPorProducto ? Number(idOrProductoId) : null),
      nombre: datos.nombre.trim(),
      costo_total: costoTotal,
      ingredientes: lista
    };
  });
};

const eliminar = async (idOrProductoId) => {
  let receta = await recetaRepository.getById(idOrProductoId);
  if (!receta) {
    receta = await recetaRepository.getByProductoId(idOrProductoId);
  }

  if (!receta) {
    throw new AppError('La receta no existe', 404, 'NO_ENCONTRADO');
  }

  await recetaRepository.delete(receta.id);
  return { id: receta.id };
};

module.exports = {
  getAll,
  getById,
  getByProductoId,
  crearReceta,
  guardar,
  eliminar,
  detectarRepetidos
};
