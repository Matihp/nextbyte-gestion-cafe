const productoRepository = require('../repositories/productoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');
const AppError = require('../utils/AppError');
const { validarProducto } = require('../dtos/producto.dto');

const getAll = async (filtros = {}) => {
  const categoriaId = filtros.categoria_id ? Number(filtros.categoria_id) : null;
  const productos = categoriaId
    ? await productoRepository.getByCategoria(categoriaId)
    : await productoRepository.getAll();

  const categorias = await categoriaRepository.getAll();
  const categoriasMap = new Map(categorias.map((c) => [c.id, c.nombre]));

  return productos.map((p) => ({
    ...p,
    categoria_nombre: categoriasMap.get(p.categoria_id) || null
  }));
};

const getById = async (id) => {
  const producto = await productoRepository.getById(id);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const categoria = await categoriaRepository.getById(producto.categoria_id);
  return {
    ...producto,
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

  const payload = {
    categoria_id: Number(datos.categoria_id),
    nombre: datos.nombre.trim(),
    precio_venta: Number(Number(datos.precio_venta).toFixed(2)),
    stock_actual:
      datos.stock_actual !== undefined && datos.stock_actual !== null && datos.stock_actual !== ''
        ? Number(datos.stock_actual)
        : 0,
    imagen: datos.imagen ? datos.imagen.trim() : null
  };

  const resultado = await productoRepository.create(payload);
  const creado = Array.isArray(resultado) ? resultado[0] : resultado;

  return {
    ...creado,
    categoria_nombre: categoria.nombre
  };
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

  const payload = {
    categoria_id: Number(datos.categoria_id),
    nombre: datos.nombre.trim(),
    precio_venta: Number(Number(datos.precio_venta).toFixed(2)),
    stock_actual:
      datos.stock_actual !== undefined && datos.stock_actual !== null && datos.stock_actual !== ''
        ? Number(datos.stock_actual)
        : actual.stock_actual,
    imagen: datos.imagen !== undefined ? (datos.imagen ? datos.imagen.trim() : null) : actual.imagen
  };

  const resultado = await productoRepository.update(id, payload);
  const actualizado = Array.isArray(resultado) ? resultado[0] : resultado;

  return {
    ...actualizado,
    categoria_nombre: categoria.nombre
  };
};

const remove = async (id) => {
  const actual = await productoRepository.getById(id);
  if (!actual) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  const detalles = await detallePedidoRepository.getByProductoId(id);
  if (detalles && detalles.length > 0) {
    throw new AppError('No se puede eliminar: el producto tiene pedidos asociados', 409, 'RELACION');
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
  remove
};

