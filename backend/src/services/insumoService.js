const { dbLocal } = require('../config/db');
const insumoRepository = require('../repositories/insumoRepository');
const proveedorRepository = require('../repositories/proveedorRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const AppError = require('../utils/AppError');
const { hoy, ahora } = require('../utils/fechas');
const {
  calcularEstadoStock,
  estaPorVencer,
  validarInsumo,
  validarIngreso,
} = require('../dtos/insumo.dto');

const enriquecerInsumo = (insumo) => {
  if (!insumo) return null;
  return {
    ...insumo,
    estado_stock: calcularEstadoStock(insumo),
    por_vencer: estaPorVencer(insumo, hoy()),
  };
};

const obtenerTodos = async () => {
  const insumos = await insumoRepository.getAll();
  return insumos.map(enriquecerInsumo);
};

const obtenerAlertas = async () => {
  const insumos = await insumoRepository.getAll();
  return insumos
    .map(enriquecerInsumo)
    .filter((insumo) => insumo.estado_stock === 'critico' || insumo.estado_stock === 'bajo');
};

const obtenerPorId = async (id) => {
  const insumo = await insumoRepository.getById(id);
  if (!insumo) {
    throw new AppError('Insumo no encontrado', 404, 'NO_ENCONTRADO');
  }
  return enriquecerInsumo(insumo);
};

const crear = async (datos) => {
  const errores = validarInsumo(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const insumos = await insumoRepository.getAll();
  const existente = insumos.find(
    (i) => i.nombre.trim().toLowerCase() === datos.nombre.trim().toLowerCase()
  );
  if (existente) {
    throw new AppError('Ya existe un insumo con ese nombre', 409, 'DUPLICADO');
  }

  const nuevo = await insumoRepository.create({
    nombre: datos.nombre.trim(),
    rubro: datos.rubro ? datos.rubro.trim() : null,
    cantidad_disponible: Number(datos.cantidad_disponible),
    unidad_medida: datos.unidad_medida,
    stock_minimo: Number(datos.stock_minimo),
    precio_costo: Number(datos.precio_costo),
    ultima_actualizacion: `${hoy()} ${ahora()}`,
    fecha_ingreso: datos.fecha_ingreso || hoy(),
    fecha_vencimiento: datos.fecha_vencimiento || null,
  });

  return enriquecerInsumo(nuevo);
};

const actualizar = async (id, datos) => {
  const actual = await insumoRepository.getById(id);
  if (!actual) {
    throw new AppError('Insumo no encontrado', 404, 'NO_ENCONTRADO');
  }

  const errores = validarInsumo(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const insumos = await insumoRepository.getAll();
  const existente = insumos.find(
    (i) => i.nombre.trim().toLowerCase() === datos.nombre.trim().toLowerCase() && i.id !== Number(id)
  );
  if (existente) {
    throw new AppError('Ya existe un insumo con ese nombre', 409, 'DUPLICADO');
  }

  const actualizado = await insumoRepository.update(id, {
    nombre: datos.nombre.trim(),
    rubro: datos.rubro ? datos.rubro.trim() : null,
    cantidad_disponible: Number(datos.cantidad_disponible),
    unidad_medida: datos.unidad_medida,
    stock_minimo: Number(datos.stock_minimo),
    precio_costo: Number(datos.precio_costo),
    ultima_actualizacion: `${hoy()} ${ahora()}`,
    fecha_ingreso: datos.fecha_ingreso || actual.fecha_ingreso,
    fecha_vencimiento:
      datos.fecha_vencimiento !== undefined ? datos.fecha_vencimiento : actual.fecha_vencimiento,
  });

  return enriquecerInsumo(actualizado);
};

const ingresarStock = async (id, cantidad) => {
  const actual = await insumoRepository.getById(id);
  if (!actual) {
    throw new AppError('Insumo no encontrado', 404, 'NO_ENCONTRADO');
  }

  const cantidadNum = Number(cantidad);
  if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
    throw new AppError('La cantidad ingresada debe ser mayor a 0', 400, 'VALIDACION');
  }

  return dbLocal.transaction(async (trx) => {
    const actualizado = await insumoRepository.ingresarStock(id, cantidadNum, trx);
    return enriquecerInsumo(actualizado);
  });
};

const eliminar = async (id) => {
  const actual = await insumoRepository.getById(id);
  if (!actual) {
    throw new AppError('Insumo no encontrado', 404, 'NO_ENCONTRADO');
  }

  const enRecetas = await ingredienteRecetaRepository.getByInsumoId(id);
  if (enRecetas && enRecetas.length > 0) {
    throw new AppError('No se puede eliminar: el insumo se usa en recetas', 409, 'RELACION');
  }

  return dbLocal.transaction(async (trx) => {
    const proveedores = await proveedorRepository.getAll(trx);
    const idNum = Number(id);

    for (const proveedor of proveedores) {
      const ids = proveedor.insumos_asignados_ids || [];
      if (ids.some((item) => Number(item) === idNum)) {
        const filtrados = ids.filter((item) => Number(item) !== idNum);
        await proveedorRepository.update(
          proveedor.id,
          {
            ...proveedor,
            insumos_asignados_ids: filtrados,
          },
          trx
        );
      }
    }

    await insumoRepository.delete(id, trx);
    return { id: Number(id) };
  });
};

module.exports = {
  obtenerTodos,
  obtenerAlertas,
  obtenerPorId,
  crear,
  actualizar,
  ingresarStock,
  eliminar,
  calcularEstadoStock,
  estaPorVencer,
  validarInsumo,
  validarIngreso,
};

