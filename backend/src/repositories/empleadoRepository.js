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
    es_empleado: Boolean(row.es_empleado !== 0 && row.es_empleado !== false),
    tiene_usuario: Boolean(row.tiene_usuario !== 0 && row.tiene_usuario !== false),
    dias_franco: parseJson(row.dias_franco, []),
    permisos: parseJson(row.permisos, [])
  };
};

const serialize = (data) => {
  const copy = { ...data };
  if (copy.dias_franco !== undefined && typeof copy.dias_franco === 'object') {
    copy.dias_franco = JSON.stringify(copy.dias_franco);
  }
  if (copy.permisos !== undefined && typeof copy.permisos === 'object') {
    copy.permisos = JSON.stringify(copy.permisos);
  }
  if (copy.es_empleado !== undefined) {
    copy.es_empleado = copy.es_empleado ? 1 : 0;
  }
  if (copy.tiene_usuario !== undefined) {
    copy.tiene_usuario = copy.tiene_usuario ? 1 : 0;
  }
  return copy;
};

module.exports = {
  getAll: async (filters = {}) => {
    let query = dbLocal(TABLE).select('*');

    if (filters.rol_id) {
      query = query.where('rol_id', filters.rol_id);
    }
    if (filters.es_empleado !== undefined) {
      query = query.where('es_empleado', filters.es_empleado ? 1 : 0);
    }
    if (filters.tiene_usuario !== undefined) {
      query = query.where('tiene_usuario', filters.tiene_usuario ? 1 : 0);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.where((qb) => {
        qb.where('nombre', 'like', term)
          .orWhere('apellido', 'like', term)
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
      email: data.email,
      contrasena: data.contrasena || data.password,
      telefono: data.telefono || null,
      direccion: data.direccion ? data.direccion.trim() : null,
      foto: data.foto || null,
      fecha_nacimiento: data.fecha_nacimiento || data.fechaNacimiento || null,
      fecha_ingreso: data.fecha_ingreso || data.fechaIngreso || null,
      turno_habitual: data.turno_habitual || data.turnoHabitual || null,
      dias_franco: data.dias_franco || data.diasFranco || [],
      permisos: data.permisos || [],
      es_empleado: data.es_empleado !== undefined ? (data.es_empleado ? 1 : 0) : 1,
      tiene_usuario: data.tiene_usuario !== undefined ? (data.tiene_usuario ? 1 : 0) : 1
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

  delete: (id) => dbLocal(TABLE).where({ id }).del()
};
