exports.config = { transaction: false };

const conFksDesactivadas = async (knex, fn) => {
  await knex.raw('PRAGMA foreign_keys = OFF');
  try {
    await fn();
    const violaciones = await knex.raw('PRAGMA foreign_key_check');
    if (violaciones.length > 0) {
      throw new Error('La migración dejó violaciones de claves foráneas');
    }
  } finally {
    await knex.raw('PRAGMA foreign_keys = ON');
  }
};

exports.up = function (knex) {
  return conFksDesactivadas(knex, () =>
    knex.schema.alterTable('insumos', function (table) {
      table.dropColumn('proveedor_id');
    })
  );
};

exports.down = function (knex) {
  return conFksDesactivadas(knex, () =>
    knex.schema.alterTable('insumos', function (table) {
      table.string('proveedor_id').nullable().references('id').inTable('proveedores').onDelete('SET NULL');
    })
  );
};
