const crypto = require('crypto');
const { dbLocal } = require('../config/db');

const TABLE = 'empleados';

const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const deserialize = (row) => {
  if (!row) return row;
  return {
    ...row,
    activo: Boolean(row.activo),
    dias_franco: parseJson(row.dias_franco, []),
    dias_trabajo: parseJson(row.dias_trabajo, {}),
    permisos: parseJson(row.permisos, [])
  };
};

const serialize = (data) => {
  const copy = { ...data };
  if (copy.dias_franco !== undefined && typeof copy.dias_franco === 'object') {
    copy.dias_franco = JSON.stringify(copy.dias_franco);
  }
  if (copy.dias_trabajo !== undefined && typeof copy.dias_trabajo === 'object') {
    copy.dias_trabajo = JSON.stringify(copy.dias_trabajo);
  }
  if (copy.permisos !== undefined && typeof copy.permisos === 'object') {
    copy.permisos = JSON.stringify(copy.permisos);
  }
  if (copy.activo !== undefined) {
    copy.activo = copy.activo ? 1 : 0;
  }
  return copy;
};

module.exports = {
  getAll: async (filters = {}) => {
    let query = dbLocal(TABLE).select('*');

    if (filters.activo !== undefined) {
      query = query.where('activo', filters.activo ? 1 : 0);
    }
    if (filters.rol_id) {
      query = query.where('rol_id', filters.rol_id);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.where((qb) => {
        qb.where('nombre', 'like', term)
          .orWhere('apellido', 'like', term)
          .orWhere('nombre_distintivo', 'like', term)
          .orWhere('legajo', 'like', term)
          .orWhere('email', 'like', term);
      });
    }

    const rows = await query.orderBy('apellido', 'asc').orderBy('nombre', 'asc');
    return rows.map(deserialize);
  },

  getById: async (id) => {
    const row = await dbLocal(TABLE).where({ id }).first();
    return deserialize(row);
  },

  getByEmail: async (email) => {
    const row = await dbLocal(TABLE).where({ email }).first();
    return deserialize(row);
  },

  getByLegajo: async (legajo) => {
    const row = await dbLocal(TABLE).where({ legajo }).first();
    return deserialize(row);
  },

  getByRol: async (rolId) => {
    const rows = await dbLocal(TABLE).where({ rol_id: rolId }).orderBy('apellido');
    return rows.map(deserialize);
  },

  create: async (data) => {
    const payload = serialize({
      id: data.id || crypto.randomUUID(),
      rol_id: data.rol_id || data.rolId || null,
      legajo: data.legajo || null,
      nombre: data.nombre,
      apellido: data.apellido,
      nombre_distintivo: data.nombre_distintivo || data.nombreDistintivo || null,
      email: data.email,
      contrasena: data.contrasena || data.password,
      telefono: data.telefono || null,
      foto: data.foto || null,
      fecha_nacimiento: data.fecha_nacimiento || data.fechaNacimiento || null,
      fecha_ingreso: data.fecha_ingreso || data.fechaIngreso || null,
      turno_habitual: data.turno_habitual || data.turnoHabitual || null,
      dias_franco: data.dias_franco || data.diasFranco || [],
      dias_trabajo: data.dias_trabajo || data.diasTrabajo || {},
      permisos: data.permisos || [],
      activo: data.activo !== undefined ? data.activo : true
    });

    await dbLocal(TABLE).insert(payload);
    return module.exports.getById(payload.id);
  },

  update: async (id, data) => {
    const payload = serialize({
      ...data,
      updated_at: dbLocal.fn.now()
    });

    await dbLocal(TABLE).where({ id }).update(payload);
    return module.exports.getById(id);
  },

  delete: (id) => dbLocal(TABLE).where({ id }).del(),

  softDelete: async (id) => {
    await dbLocal(TABLE).where({ id }).update({ activo: 0, updated_at: dbLocal.fn.now() });
    return module.exports.getById(id);
  },

  reactivate: async (id) => {
    await dbLocal(TABLE).where({ id }).update({ activo: 1, updated_at: dbLocal.fn.now() });
    return module.exports.getById(id);
  }
};
