const crypto = require('crypto');
const { dbLocal } = require('../config/db');

const TABLE = 'turnos_empleados';

const deserialize = (row) => {
  if (!row) return row;
  return {
    ...row,
    es_excepcional: Boolean(row.es_excepcional)
  };
};

module.exports = {
  getAll: async (filters = {}) => {
    let query = dbLocal(TABLE).select('*');

    if (filters.empleado_id || filters.empleadoId) {
      query = query.where('empleado_id', filters.empleado_id || filters.empleadoId);
    }
    if (filters.fecha) {
      query = query.where('fecha', filters.fecha);
    }
    if (filters.estado) {
      query = query.where('estado', filters.estado);
    }
    if (filters.es_excepcional !== undefined) {
      query = query.where('es_excepcional', filters.es_excepcional ? 1 : 0);
    }
    if (filters.desde) {
      query = query.where('fecha', '>=', filters.desde);
    }
    if (filters.hasta) {
      query = query.where('fecha', '<=', filters.hasta);
    }

    const rows = await query.orderBy('fecha', 'desc');
    return rows.map(deserialize);
  },

  getById: async (id) => {
    const row = await dbLocal(TABLE).where({ id }).first();
    return deserialize(row);
  },

  getByEmpleadoId: async (empleadoId) => {
    const rows = await dbLocal(TABLE).where({ empleado_id: empleadoId }).orderBy('fecha', 'desc');
    return rows.map(deserialize);
  },

  getByFecha: async (fecha) => {
    const rows = await dbLocal(TABLE).where({ fecha }).orderBy('empleado_id');
    return rows.map(deserialize);
  },

  getByDateRange: async (desde, hasta, empleadoId = null) => {
    let query = dbLocal(TABLE).whereBetween('fecha', [desde, hasta]);
    if (empleadoId) {
      query = query.where('empleado_id', empleadoId);
    }
    const rows = await query.orderBy('fecha', 'asc');
    return rows.map(deserialize);
  },

  create: async (data) => {
    const payload = {
      id: data.id || crypto.randomUUID(),
      empleado_id: data.empleado_id || data.empleadoId,
      fecha: data.fecha,
      estado: data.estado,
      hora_entrada: data.hora_entrada || data.horaEntrada || null,
      hora_salida: data.hora_salida || data.horaSalida || null,
      es_excepcional: data.es_excepcional ? 1 : 0,
      observaciones: data.observaciones || null
    };

    await dbLocal(TABLE).insert(payload);
    return module.exports.getById(payload.id);
  },

  update: async (id, data) => {
    const payload = {
      ...data,
      updated_at: dbLocal.fn.now()
    };
    if (payload.es_excepcional !== undefined) {
      payload.es_excepcional = payload.es_excepcional ? 1 : 0;
    }

    await dbLocal(TABLE).where({ id }).update(payload);
    return module.exports.getById(id);
  },

  delete: (id) => dbLocal(TABLE).where({ id }).del(),

  upsertByDate: async (empleadoId, fecha, data) => {
    const existing = await dbLocal(TABLE).where({ empleado_id: empleadoId, fecha }).first();
    if (existing) {
      return module.exports.update(existing.id, data);
    }
    return module.exports.create({
      ...data,
      empleado_id: empleadoId,
      fecha
    });
  }
};
