const crypto = require('crypto');
const { dbLocal } = require('../config/db');

const TABLE = 'turnos_empleados';

const deserialize = (row) => row;

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
      estado: data.estado
    };

    await dbLocal(TABLE).insert(payload);
    return module.exports.getById(payload.id);
  },

  update: async (id, data) => {
    await dbLocal(TABLE)
      .where({ id })
      .update({
        ...data,
        updated_at: dbLocal.fn.now()
      });
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
