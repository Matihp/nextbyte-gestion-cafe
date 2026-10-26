const { dbLocal } = require("../config/db");

const TABLE = "proveedores";

const deserialize = (row) => {
  if (!row) return row;
  let insumosIds = row.insumos_asignados_ids;
  if (typeof insumosIds === "string") {
    try {
      insumosIds = JSON.parse(insumosIds);
    } catch {
      insumosIds = [];
    }
  }
  return {
    ...row,
    insumos_asignados_ids: insumosIds || [],
  };
};

module.exports = {
  getAll: async () => {
    const rows = await dbLocal(TABLE).select("*").orderBy("empresa", "asc");
    return rows.map(deserialize);
  },

  getById: async (id) => {
    const row = await dbLocal(TABLE).where({ id }).first();
    return deserialize(row);
  },

  getByCodigo: async (codigo) => {
    const row = await dbLocal(TABLE).where({ codigo }).first();
    return deserialize(row);
  },

  create: async (data) => {
    const payload = {
      id: data.id,
      codigo: data.codigo,
      empresa: data.empresa,
      nombre_contacto: data.nombre_contacto || data.nombreContacto || null,
      apellido_contacto: data.apellido_contacto || data.apellidoContacto || null,
      telefono: data.telefono || null,
      email: data.email || null,
      rubro: data.rubro || null,
      insumos_asignados_ids: JSON.stringify(
        data.insumos_asignados_ids || data.insumosAsignadosIds || []
      ),
    };

    await dbLocal(TABLE).insert(payload);
    return module.exports.getById(payload.id);
  },

  update: async (id, data) => {
    const payload = {
      codigo: data.codigo,
      empresa: data.empresa,
      nombre_contacto: data.nombre_contacto || data.nombreContacto,
      apellido_contacto: data.apellido_contacto || data.apellidoContacto,
      telefono: data.telefono,
      email: data.email,
      rubro: data.rubro,
    };

    if (data.insumos_asignados_ids !== undefined || data.insumosAsignadosIds !== undefined) {
      payload.insumos_asignados_ids = JSON.stringify(
        data.insumos_asignados_ids || data.insumosAsignadosIds || []
      );
    }

    await dbLocal(TABLE).where({ id }).update(payload);
    return module.exports.getById(id);
  },

  delete: (id) => dbLocal(TABLE).where({ id }).del(),
};
