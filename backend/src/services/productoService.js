const { dbLocal } = require('../config/db');
const productoRepository = require('../repositories/productoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');
const recetaRepository = require('../repositories/recetaRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const insumoRepository = require('../repositories/insumoRepository');
const AppError = require('../utils/AppError');
const { validarProducto } = require('../dtos/producto.dto');

const calcularCostoProducto = async (productoId, trx = null) => {
  const receta = await recetaRepository.getByProductoId(productoId, trx);
  if (!receta) return 0;
  const ingredientes = await ingredienteRecetaRepository.getByRecetaId(receta.id, trx);
  if (!ingredientes || ingredientes.length === 0) return 0;
  let total = 0;
  for (const ing of ingredientes) {
    const insumo = await insumoRepository.getById(ing.insumo_id, trx);
    if (insumo) {
      total += Number(insumo.precio_costo || 0) * Number(ing.cantidad || 0);
    }
  }
  return Number(total.toFixed(2));
};

const getAll = async (filtros = {}) => {
  const categoriaId = filtros.categoria_id ? Number(filtros.categoria_id) : null;
  const productos = categoriaId
    ? await productoRepository.getByCategoria(categoriaId)
    : await productoRepository.getAll();

  const categorias = await categoriaRepository.getAll();
  const categoriasMap = new Map(categorias.map((c) => [c.id, c.nombre]));

  // Cargar insumos y recetas para calcular precio_costo dinámicamente
  const [recetas, ingredientesRecetas, insumos] = await Promise.all([
    dbLocal('recetas').select('*').catch(() => []),
    dbLocal('ingredientes_recetas').select('*').catch(() => []),
    dbLocal('insumos').select('*').catch(() => [])
  ]);

  const insumosMap = new Map(insumos.map((i) => [Number(i.id), Number(i.precio_costo || 0)]));
  const recetaPorProducto = new Map(recetas.map((r) => [Number(r.producto_id), r.id]));
  const costoPorReceta = new Map();

  for (const ing of ingredientesRecetas) {
    const costoUnit = insumosMap.get(Number(ing.insumo_id)) || 0;
    const subtotal = costoUnit * Number(ing.cantidad || 0);
    const recId = Number(ing.receta_id);
    costoPorReceta.set(recId, (costoPorReceta.get(recId) || 0) + subtotal);
  }

  return productos.map((p) => {
    const recetaId = recetaPorProducto.get(Number(p.id));
    const precioCosto = recetaId ? Number((costoPorReceta.get(recetaId) || 0).toFixed(2)) : 0;
    return {
      ...p,
      precio_costo: precioCosto,
      categoria_nombre: categoriasMap.get(p.categoria_id) || null
    };
  });
};

const getById = async (id) => {
  const producto = await productoRepository.getById(id);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const categoria = await categoriaRepository.getById(producto.categoria_id);
  const precioCosto = await calcularCostoProducto(id);

  return {
    ...producto,
    precio_costo: precioCosto,
    categoria_nombre: categoria ? categoria.nombre : null
  };
};

const create = async (datos) => {
  const errores = validarProducto(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const categoria = await categoriaRepository.getById(datos.categoria_id);
  if (!categoria) {
    throw new AppError('La categoría no existe', 404, 'NO_ENCONTRADO');
  }

  const productos = await productoRepository.getByCategoria(datos.categoria_id);
  const nombreNormalizado = datos.nombre.trim().toLowerCase();
  const existente = productos.find((p) => p.nombre.trim().toLowerCase() === nombreNormalizado);

  if (existente) {
    throw new AppError('Ya existe un producto con ese nombre en esta categoría', 409, 'DUPLICADO');
  }

  const nuevoStock =
    datos.stock_actual !== undefined && datos.stock_actual !== null && datos.stock_actual !== ''
      ? Number(datos.stock_actual)
      : 0;

  return dbLocal.transaction(async (trx) => {
    // Si se crea con stock > 0 y se especificó una receta asociada, validar y descontar insumos
    if (nuevoStock > 0 && datos.receta_id) {
      const receta = await trx('recetas')
        .where({ id: datos.receta_id })
        .orWhere({ producto_id: datos.receta_id })
        .first();

      if (receta) {
        const ingredientes = await trx('ingredientes_recetas').where({ receta_id: receta.id });
        for (const ing of ingredientes) {
          const insumo = await insumoRepository.getById(ing.insumo_id, trx);
          const cantidadRequerida = Number((Number(ing.cantidad) * nuevoStock).toFixed(4));
          const disponible = Number(insumo ? insumo.cantidad_disponible : 0);
          if (disponible < cantidadRequerida) {
            const faltante = Number((cantidadRequerida - disponible).toFixed(3));
            throw new AppError(
              `No hay suficiente stock de insumos en el inventario para fabricar esta cantidad. Faltan ${faltante} ${insumo?.unidad_medida || 'un'} de "${insumo?.nombre || 'Insumo'}" (Disponible: ${disponible} ${insumo?.unidad_medida || 'un'})`,
              409,
              'STOCK_INSUFICIENTE'
            );
          }
        }

        // Si todos alcanzan, descontar insumos de inventario
        for (const ing of ingredientes) {
          const cantidadRequerida = Number((Number(ing.cantidad) * nuevoStock).toFixed(4));
          await insumoRepository.descontarStock(ing.insumo_id, cantidadRequerida, trx);
        }
      }
    }

    const payload = {
      categoria_id: Number(datos.categoria_id),
      nombre: datos.nombre.trim(),
      precio_venta: Number(Number(datos.precio_venta).toFixed(2)),
      stock_actual: nuevoStock,
      imagen: datos.imagen ? datos.imagen.trim() : null
    };

    const resultado = await trx('productos').insert(payload);
    const id = Array.isArray(resultado) ? resultado[0] : resultado;
    const creado = await trx('productos').where({ id }).first();

    if (datos.receta_id) {
      await trx('recetas')
        .where({ id: datos.receta_id })
        .orWhere({ producto_id: datos.receta_id })
        .update({ producto_id: id });
    }

    const precioCosto = await calcularCostoProducto(id, trx);

    return {
      ...creado,
      precio_costo: precioCosto,
      categoria_nombre: categoria.nombre
    };
  });
};

const update = async (id, datos) => {
  const actual = await productoRepository.getById(id);
  if (!actual) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const errores = validarProducto(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const categoria = await categoriaRepository.getById(datos.categoria_id);
  if (!categoria) {
    throw new AppError('La categoría no existe', 404, 'NO_ENCONTRADO');
  }

  const productos = await productoRepository.getByCategoria(datos.categoria_id);
  const nombreNormalizado = datos.nombre.trim().toLowerCase();
  const duplicado = productos.find(
    (p) => p.nombre.trim().toLowerCase() === nombreNormalizado && Number(p.id) !== Number(id)
  );

  if (duplicado) {
    throw new AppError('Ya existe un producto con ese nombre en esta categoría', 409, 'DUPLICADO');
  }

  const nuevoStock =
    datos.stock_actual !== undefined && datos.stock_actual !== null && datos.stock_actual !== ''
      ? Number(datos.stock_actual)
      : actual.stock_actual;

  const stockDiff = nuevoStock - Number(actual.stock_actual || 0);

  return dbLocal.transaction(async (trx) => {
    // Si se incrementó el stock (stockDiff > 0), verificar receta y descontar insumos
    if (stockDiff > 0) {
      let receta = await trx('recetas').where({ producto_id: id }).first();
      if (!receta && datos.receta_id) {
        receta = await trx('recetas')
          .where({ id: datos.receta_id })
          .orWhere({ producto_id: datos.receta_id })
          .first();
      }

      if (receta) {
        const ingredientes = await trx('ingredientes_recetas').where({ receta_id: receta.id });
        for (const ing of ingredientes) {
          const insumo = await insumoRepository.getById(ing.insumo_id, trx);
          const cantidadRequerida = Number((Number(ing.cantidad) * stockDiff).toFixed(4));
          const disponible = Number(insumo ? insumo.cantidad_disponible : 0);
          if (disponible < cantidadRequerida) {
            const faltante = Number((cantidadRequerida - disponible).toFixed(3));
            throw new AppError(
              `No hay suficiente stock de insumos en el inventario para fabricar esta cantidad. Faltan ${faltante} ${insumo?.unidad_medida || 'un'} de "${insumo?.nombre || 'Insumo'}" (Disponible: ${disponible} ${insumo?.unidad_medida || 'un'})`,
              409,
              'STOCK_INSUFICIENTE'
            );
          }
        }

        // Si todos alcanzan, descontar de cada insumo
        for (const ing of ingredientes) {
          const cantidadRequerida = Number((Number(ing.cantidad) * stockDiff).toFixed(4));
          await insumoRepository.descontarStock(ing.insumo_id, cantidadRequerida, trx);
        }
      }
    }

    if (datos.receta_id) {
      await trx('recetas')
        .where({ id: datos.receta_id })
        .orWhere({ producto_id: datos.receta_id })
        .update({ producto_id: id });
    }

    const payload = {
      categoria_id: Number(datos.categoria_id),
      nombre: datos.nombre.trim(),
      precio_venta: Number(Number(datos.precio_venta).toFixed(2)),
      stock_actual: nuevoStock,
      imagen: datos.imagen !== undefined ? (datos.imagen ? datos.imagen.trim() : null) : actual.imagen
    };

    await trx('productos').where({ id }).update(payload);
    const actualizado = await trx('productos').where({ id }).first();
    const precioCosto = await calcularCostoProducto(id, trx);

    return {
      ...actualizado,
      precio_costo: precioCosto,
      categoria_nombre: categoria.nombre
    };
  });
};

const remove = async (id, motivo = null) => {
  const actual = await productoRepository.getById(id);
  if (!actual) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const detalles = await detallePedidoRepository.getByProductoId(id);
  if (detalles && detalles.length > 0) {
    throw new AppError('No se puede eliminar: el producto tiene pedidos asociados', 409, 'RELACION');
  }

  if (motivo) {
    try {
      const categoria = actual.categoria_id
        ? await categoriaRepository.getById(actual.categoria_id)
        : null;
      const crypto = require('crypto');
      const { hoy } = require('../utils/fechas');
      await dbLocal('registros_mermas').insert({
        id: crypto.randomUUID(),
        producto_id: actual.id,
        nombre_producto: actual.nombre,
        nombre_categoria: categoria ? categoria.nombre : null,
        motivo: String(motivo).trim(),
        fecha: hoy(),
        cantidad: actual.stock_actual > 0 ? actual.stock_actual : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Advertencia al registrar auditoría de producto eliminado:', e.message);
    }
  }

  await productoRepository.delete(id);
  return { id: actual.id };
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
  remove,
  calcularCostoProducto
};
