const crypto = require('crypto');
const { dbLocal } = require('../config/db');

const TABLE = 'roles';

const deserialize = (row) => {
  if (!row) return row;
  let permisos = row.permisos;
  if (typeof permisos === 'string') {
    try {
      permisos = JSON.parse(permisos);
    } catch {
      permisos = [];
    }
  }
  return {
    ...row,
    es_admin: Boolean(row.es_admin),
    permisos: permisos || []
  };
};

module.exports = {
  getAll: async () => {
    const rows = await dbLocal(TABLE).orderBy('nombre');
    return rows.map(deserialize);
  },

  getById: async (id) => {
    const row = await dbLocal(TABLE).where({ id }).first();
    return deserialize(row);
  },

  getByName: async (nombre) => {
    const row = await dbLocal(TABLE).where({ nombre }).first();
    return deserialize(row);
  },

  create: async (data) => {
    const payload = {
      id: data.id || crypto.randomUUID(),
      nombre: data.nombre,
      es_admin: data.es_admin ? 1 : 0,
      permisos: data.permisos ? JSON.stringify(data.permisos) : '[]'
    };

    await dbLocal(TABLE).insert(payload);
    return module.exports.getById(payload.id);
  },

  update: async (id, data) => {
    const payload = { ...data, updated_at: dbLocal.fn.now() };

    if (payload.permisos !== undefined && typeof payload.permisos === 'object') {
      payload.permisos = JSON.stringify(payload.permisos);
    }
    if (payload.es_admin !== undefined) {
      payload.es_admin = payload.es_admin ? 1 : 0;
    }

    await dbLocal(TABLE).where({ id }).update(payload);
    return module.exports.getById(id);
  },

  delete: (id) => dbLocal(TABLE).where({ id }).del()
};
