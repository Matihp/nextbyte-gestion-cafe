const { dbLocal } = require('../config/db');
const productoRepository = require('../repositories/productoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const AppError = require('../utils/AppError');
const { validarProducto } = require('../dtos/producto.dto');

const calcularCostoProducto = async (productoId, trx = null) => {
  const prod = await productoRepository.getByIdWithDetails(productoId, trx);
  return prod ? Number(prod.precio_costo) || 0 : 0;
};

const getAll = async (filtros = {}) => {
  const categoriaId = filtros.categoria_id ? Number(filtros.categoria_id) : null;
  const productos = await productoRepository.getAllWithDetails(categoriaId);
  return productos.map((p) => ({ ...p, precio_costo: Number(p.precio_costo) || 0 }));
};

const getById = async (id) => {
  const producto = await productoRepository.getByIdWithDetails(id);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }
  return { ...producto, precio_costo: Number(producto.precio_costo) || 0 };
};

// Igual que la lectura de costos: referencia explícita, o receta por producto si es null.
const resolverReceta = async (recetaId, productoId, trx) => {
  if (recetaId != null) {
    if (!Number.isSafeInteger(Number(recetaId)) || Number(recetaId) <= 0) {
      throw new AppError('La receta debe tener un ID válido', 400, 'VALIDACION');
    }
    const receta = await trx('recetas').where({ id: recetaId }).first();
    if (!receta) {
      throw new AppError('La receta no existe', 404, 'NO_ENCONTRADO');
    }
    return receta;
  }
  return productoId ? trx('recetas').where({ producto_id: productoId }).first() : null;
};

const consumirIngredientes = async (receta, unidades, trx) => {
  if (!receta || unidades <= 0) return;
  const ingredientes = await trx('ingredientes_recetas').where({ receta_id: receta.id });
  const consumo = new Map();
  for (const ing of ingredientes) {
    const cantidad = Number(ing.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new AppError('La receta contiene cantidades inválidas', 409, 'RECETA_INVALIDA');
    }
    const insumoId = Number(ing.insumo_id);
    consumo.set(insumoId, (consumo.get(insumoId) || 0) + cantidad * unidades);
  }
  // Agrupar insumos repetidos y ordenar reduce conflictos entre reposiciones concurrentes.
  for (const [insumoId, consumoTotal] of [...consumo].sort((a, b) => a[0] - b[0])) {
    const cantidad = Number(consumoTotal.toFixed(4));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new AppError('El consumo de la receta es inválido', 409, 'RECETA_INVALIDA');
    }
    const afectados = await trx('insumos').where({ id: insumoId })
      .where('cantidad_disponible', '>=', cantidad)
      .decrement('cantidad_disponible', cantidad)
      .update({ ultima_actualizacion: trx.fn.now() });
    if (afectados !== 1) {
      const insumo = await trx('insumos').where({ id: insumoId }).first();
      throw new AppError(
        `No hay suficiente stock de insumos en el inventario para fabricar esta cantidad: ${insumo?.nombre || 'Insumo'}`,
        409,
        'STOCK_INSUFICIENTE'
      );
    }
  }
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

  const nuevoStock = datos.stock_actual !== undefined && datos.stock_actual !== null && datos.stock_actual !== ''
    ? Number(datos.stock_actual) : 0;
  return dbLocal.transaction(async (trx) => {
    const recetaId = datos.receta_id ? Number(datos.receta_id) : null;
    const receta = await resolverReceta(recetaId, null, trx);
    await consumirIngredientes(receta, nuevoStock, trx);
    const payload = {
      categoria_id: Number(datos.categoria_id),
      nombre: datos.nombre.trim(),
      precio_venta: Number(Number(datos.precio_venta).toFixed(2)),
      stock_actual: nuevoStock,
      receta_id: recetaId,
      imagen: datos.imagen ? datos.imagen.trim() : null
    };
    const resultado = await trx('productos').insert(payload);
    const id = Array.isArray(resultado) ? (resultado[0]?.id || resultado[0]) : resultado;
    const creado = await productoRepository.getByIdWithDetails(id, trx);
    return { ...creado, precio_costo: Number(creado.precio_costo) || 0 };
  });
};

const update = async (id, datos) => {
  const errores = validarProducto(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  return dbLocal.transaction(async (trx) => {
    const actual = await trx('productos').where({ id }).forUpdate().first();
    if (!actual) {
      throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
    }
    const categoria = await categoriaRepository.getById(datos.categoria_id, trx);
    if (!categoria) {
      throw new AppError('La categoría no existe', 404, 'NO_ENCONTRADO');
    }
    const productos = await trx('productos').where({ categoria_id: datos.categoria_id });
    const nombreNormalizado = datos.nombre.trim().toLowerCase();
    const duplicado = productos.find(
      (p) => p.nombre.trim().toLowerCase() === nombreNormalizado && Number(p.id) !== Number(id)
    );
    if (duplicado) {
      throw new AppError('Ya existe un producto con ese nombre en esta categoría', 409, 'DUPLICADO');
    }

    const nuevoStock = datos.stock_actual !== undefined && datos.stock_actual !== null && datos.stock_actual !== ''
      ? Number(datos.stock_actual) : Number(actual.stock_actual);
    const stockDiff = nuevoStock - Number(actual.stock_actual || 0);
    const recetaId = datos.receta_id !== undefined
      ? (datos.receta_id ? Number(datos.receta_id) : null) : actual.receta_id;
    const receta = await resolverReceta(recetaId, actual.id, trx);
    const payload = {
      categoria_id: Number(datos.categoria_id),
      nombre: datos.nombre.trim(),
      precio_venta: Number(Number(datos.precio_venta).toFixed(2)),
      stock_actual: nuevoStock,
      receta_id: recetaId,
      imagen: datos.imagen !== undefined ? (datos.imagen ? datos.imagen.trim() : null) : actual.imagen,
      updated_at: trx.fn.now()
    };
    const afectados = await trx('productos').where({ id, stock_actual: actual.stock_actual }).update(payload);
    if (afectados !== 1) {
      throw new AppError('El stock del producto cambió; vuelva a consultar', 409, 'STOCK_INVALIDO');
    }
    await consumirIngredientes(receta, stockDiff, trx);
    const actualizado = await productoRepository.getByIdWithDetails(id, trx);
    return { ...actualizado, precio_costo: Number(actualizado.precio_costo) || 0 };
  });
};

const remove = async (id, motivo = null, cantidad = null) => dbLocal.transaction(async (trx) => {
  const actual = await trx('productos').where({ id }).forUpdate().first();
  if (!actual) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }
  const pedidoActivo = await trx('detalles_pedidos as dp')
    .join('pedidos as p', 'dp.pedido_id', 'p.id')
    .where('dp.producto_id', id)
    .whereIn('p.estado', ['pendiente', 'en_preparacion', 'en_empaque'])
    .first();
  if (pedidoActivo) {
    throw new AppError('No se puede eliminar: el producto tiene pedidos asociados', 409, 'RELACION');
  }

  let motivoNormalizado = 'Merma';
  if (motivo) {
    const mUpper = String(motivo).toUpperCase().trim();
    if (mUpper.includes('VENCID')) motivoNormalizado = 'Vencido';
    else if (mUpper.includes('FALTA')) motivoNormalizado = 'En falta';
  }
  const stockActual = Number(actual.stock_actual) || 0;
  const cantEliminar = cantidad !== null && cantidad !== undefined && Number(cantidad) > 0
    ? Number(cantidad) : (stockActual > 0 ? stockActual : 1);
  if (!Number.isSafeInteger(cantEliminar)) {
    throw new AppError('La cantidad debe ser un entero mayor a cero', 400, 'VALIDACION');
  }
  if (cantidad != null && Number(cantidad) > stockActual) {
    throw new AppError('Stock insuficiente del producto', 409, 'STOCK_INSUFICIENTE');
  }
  const precioCosto = await calcularCostoProducto(actual.id, trx);
  const categoria = actual.categoria_id
    ? await trx('categorias').where({ id: actual.categoria_id }).first() : null;
  const crypto = require('crypto');
  const { hoy } = require('../utils/fechas');
  const tieneColCosto = await trx.schema.hasColumn('registros_mermas', 'precio_costo');
  const payloadMerma = {
    id: crypto.randomUUID(),
    producto_id: actual.id,
    nombre_producto: actual.nombre,
    nombre_categoria: categoria ? categoria.nombre : null,
    motivo: motivoNormalizado,
    fecha: hoy(),
    cantidad: cantEliminar,
    created_at: trx.fn.now(),
    updated_at: trx.fn.now()
  };
  if (tieneColCosto) payloadMerma.precio_costo = precioCosto;
  // Si falla la auditoría también debe revertirse la modificación del inventario.
  await trx('registros_mermas').insert(payloadMerma);

  if (stockActual > 0 && cantEliminar < stockActual) {
    const afectados = await trx('productos').where({ id, stock_actual: actual.stock_actual })
      .where('stock_actual', '>=', cantEliminar)
      .decrement('stock_actual', cantEliminar)
      .update({ updated_at: trx.fn.now() });
    if (afectados !== 1) {
      throw new AppError('El stock del producto cambió; vuelva a consultar', 409, 'STOCK_INVALIDO');
    }
    return { id: actual.id, parcial: true, stock_restante: stockActual - cantEliminar, cantidad_eliminada: cantEliminar };
  }

  // Preservar el historial aunque se quite el producto del catálogo.
  await trx('detalles_pedidos').where({ producto_id: id }).update({ producto_id: null });
  await trx('recetas').where({ producto_id: id }).delete();
  const eliminados = await trx('productos').where({ id, stock_actual: actual.stock_actual }).delete();
  if (eliminados !== 1) {
    throw new AppError('El stock del producto cambió; vuelva a consultar', 409, 'STOCK_INVALIDO');
  }
  return { id: actual.id };
});

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
  remove,
  calcularCostoProducto
};
