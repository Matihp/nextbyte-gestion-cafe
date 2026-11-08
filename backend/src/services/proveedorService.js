const crypto = require('crypto');
const proveedorRepository = require('../repositories/proveedorRepository');
const insumoRepository = require('../repositories/insumoRepository');
const AppError = require('../utils/AppError');
const { validarProveedor, normalizarIdsInsumos } = require('../dtos/proveedor.dto');

const resolverInsumos = async (ids = []) => {
  if (!ids || ids.length === 0) return [];
  const rows = await insumoRepository.getByIds(ids);
  const rowsMap = new Map(rows.map((r) => [Number(r.id), r]));
  return ids
    .map((id) => {
      const insumo = rowsMap.get(Number(id));
      if (!insumo) return null;
      return {
        id: insumo.id,
        nombre: insumo.nombre,
        unidad_medida: insumo.unidad_medida,
      };
    })
    .filter(Boolean);
};

const formatearProveedor = async (proveedor) => {
  if (!proveedor) return null;
  const insumos = await resolverInsumos(proveedor.insumos_asignados_ids || []);
  return {
    ...proveedor,
    insumos_asignados_ids: proveedor.insumos_asignados_ids || [],
    insumos,
  };
};

const validarExistenciaInsumos = async (ids = []) => {
  if (!ids || ids.length === 0) return;
  const encontrados = await insumoRepository.getByIds(ids);
  const encontradosSet = new Set(encontrados.map((i) => Number(i.id)));
  for (const id of ids) {
    if (!encontradosSet.has(Number(id))) {
      throw new AppError(`El insumo ${id} no existe`, 404, 'NO_ENCONTRADO');
    }
  }
};

const obtenerTodos = async () => {
  const proveedores = await proveedorRepository.getAll();
  if (!proveedores || proveedores.length === 0) return [];

  const todosInsumoIds = new Set();
  for (const p of proveedores) {
    if (Array.isArray(p.insumos_asignados_ids)) {
      for (const id of p.insumos_asignados_ids) {
        todosInsumoIds.add(Number(id));
      }
    }
  }

  const insumosRows = todosInsumoIds.size > 0
    ? await insumoRepository.getByIds(Array.from(todosInsumoIds))
    : [];
  const insumosMap = new Map(insumosRows.map((i) => [Number(i.id), {
    id: i.id,
    nombre: i.nombre,
    unidad_medida: i.unidad_medida
  }]));

  return proveedores.map((proveedor) => {
    const ids = proveedor.insumos_asignados_ids || [];
    const insumos = ids
      .map((id) => insumosMap.get(Number(id)))
      .filter(Boolean);

    return {
      ...proveedor,
      insumos_asignados_ids: ids,
      insumos
    };
  });
};

const obtenerPorId = async (id) => {
  const proveedor = await proveedorRepository.getById(id);
  if (!proveedor) {
    throw new AppError('Proveedor no encontrado', 404, 'NO_ENCONTRADO');
  }
  return formatearProveedor(proveedor);
};

const crear = async (datos) => {
  const errores = validarProveedor(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const existente = await proveedorRepository.getByCodigo(datos.codigo.trim());
  if (existente) {
    throw new AppError('Ya existe un proveedor con ese código', 409, 'DUPLICADO');
  }

  const idsInsumos = normalizarIdsInsumos(datos.insumos_asignados_ids || []);
  await validarExistenciaInsumos(idsInsumos);

  const id = crypto.randomUUID();
  const nuevoProveedor = await proveedorRepository.create({
    id,
    codigo: datos.codigo.trim(),
    empresa: datos.empresa.trim(),
    nombre_contacto: datos.nombre_contacto ? datos.nombre_contacto.trim() : null,
    apellido_contacto: datos.apellido_contacto ? datos.apellido_contacto.trim() : null,
    telefono: datos.telefono ? datos.telefono.trim() : null,
    email: datos.email ? datos.email.trim() : null,
    rubro: datos.rubro ? datos.rubro.trim() : null,
    insumos_asignados_ids: idsInsumos,
  });

  return formatearProveedor(nuevoProveedor);
};

const actualizar = async (id, datos) => {
  const actual = await proveedorRepository.getById(id);
  if (!actual) {
    throw new AppError('Proveedor no encontrado', 404, 'NO_ENCONTRADO');
  }

  const errores = validarProveedor(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const existente = await proveedorRepository.getByCodigo(datos.codigo.trim());
  if (existente && existente.id !== id) {
    throw new AppError('Ya existe un proveedor con ese código', 409, 'DUPLICADO');
  }

  const idsInsumos = normalizarIdsInsumos(datos.insumos_asignados_ids || []);
  await validarExistenciaInsumos(idsInsumos);

  const actualizado = await proveedorRepository.update(id, {
    codigo: datos.codigo.trim(),
    empresa: datos.empresa.trim(),
    nombre_contacto: datos.nombre_contacto ? datos.nombre_contacto.trim() : null,
    apellido_contacto: datos.apellido_contacto ? datos.apellido_contacto.trim() : null,
    telefono: datos.telefono ? datos.telefono.trim() : null,
    email: datos.email ? datos.email.trim() : null,
    rubro: datos.rubro ? datos.rubro.trim() : null,
    insumos_asignados_ids: idsInsumos,
  });

  return formatearProveedor(actualizado);
};

const eliminar = async (id) => {
  const actual = await proveedorRepository.getById(id);
  if (!actual) {
    throw new AppError('Proveedor no encontrado', 404, 'NO_ENCONTRADO');
  }

  await proveedorRepository.delete(id);
  return { id };
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  validarProveedor,
  normalizarIdsInsumos,
};

