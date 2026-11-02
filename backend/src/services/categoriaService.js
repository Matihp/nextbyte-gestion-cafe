const categoriaRepository = require('../repositories/categoriaRepository');
const productoRepository = require('../repositories/productoRepository');
const AppError = require('../utils/AppError');
const { validarCategoria } = require('../dtos/categoria.dto');

const normalizarNombre = (nombre) => {
  if (typeof nombre !== 'string') return '';
  return nombre.trim().toLowerCase();
};

const getAll = async () => {
  return categoriaRepository.getAll();
};

const getById = async (id) => {
  const categoria = await categoriaRepository.getById(id);
  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404, 'NO_ENCONTRADO');
  }
  return categoria;
};

const create = async (datos) => {
  const errores = validarCategoria(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const categorias = await categoriaRepository.getAll();
  const nombreNormalizado = normalizarNombre(datos.nombre);
  const existente = categorias.find((c) => normalizarNombre(c.nombre) === nombreNormalizado);

  if (existente) {
    throw new AppError('Ya existe una categoría con ese nombre', 409, 'DUPLICADO');
  }

  const payload = {
    nombre: datos.nombre.trim(),
    icono: datos.icono ? datos.icono.trim() : null
  };

  const resultado = await categoriaRepository.create(payload);
  return Array.isArray(resultado) ? resultado[0] : resultado;
};

const update = async (id, datos) => {
  const categoria = await categoriaRepository.getById(id);
  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404, 'NO_ENCONTRADO');
  }

  const errores = validarCategoria(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const categorias = await categoriaRepository.getAll();
  const nombreNormalizado = normalizarNombre(datos.nombre);
  const duplicada = categorias.find(
    (c) => normalizarNombre(c.nombre) === nombreNormalizado && Number(c.id) !== Number(id)
  );

  if (duplicada) {
    throw new AppError('Ya existe una categoría con ese nombre', 409, 'DUPLICADO');
  }

  const payload = {
    nombre: datos.nombre.trim(),
    icono: datos.icono !== undefined ? (datos.icono ? datos.icono.trim() : null) : categoria.icono
  };

  const resultado = await categoriaRepository.update(id, payload);
  return Array.isArray(resultado) ? resultado[0] : resultado;
};

const remove = async (id) => {
  const categoria = await categoriaRepository.getById(id);
  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404, 'NO_ENCONTRADO');
  }

  const productos = await productoRepository.getByCategoria(id);
  if (productos && productos.length > 0) {
    throw new AppError('No se puede eliminar: la categoría tiene productos', 409, 'RELACION');
  }

  await categoriaRepository.delete(id);
  return { id: categoria.id };
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
  remove,
  normalizarNombre
};

