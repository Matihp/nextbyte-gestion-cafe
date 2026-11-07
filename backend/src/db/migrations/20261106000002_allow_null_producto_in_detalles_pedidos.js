exports.config = { transaction: false };

const conFksDesactivadas = async (knex, fn) => {
  await knex.raw('PRAGMA foreign_keys = OFF');
  try {
    await fn();
    const violaciones = await knex.raw('PRAGMA foreign_key_check');
    if (violaciones && violaciones.length > 0) {
      throw new Error('La migración dejó violaciones de claves foráneas');
    }
  } finally {
    await knex.raw('PRAGMA foreign_keys = ON');
  }
};

exports.up = async function (knex) {
  await conFksDesactivadas(knex, async () => {
    // 1. Permitir producto_id nullable en detalles_pedidos
    await knex.schema.alterTable('detalles_pedidos', function (table) {
      table.integer('producto_id').unsigned().nullable().alter();
    });

    // 2. Agregar columna precio_costo a registros_mermas si no existe
    const tienePrecioCosto = await knex.schema.hasColumn('registros_mermas', 'precio_costo');
    if (!tienePrecioCosto) {
      await knex.schema.alterTable('registros_mermas', function (table) {
        table.decimal('precio_costo', 10, 2).nullable().defaultTo(0.00);
      });
    }
  });
};

exports.down = async function (knex) {
  await conFksDesactivadas(knex, async () => {
    const tienePrecioCosto = await knex.schema.hasColumn('registros_mermas', 'precio_costo');
    if (tienePrecioCosto) {
      await knex.schema.alterTable('registros_mermas', function (table) {
        table.dropColumn('precio_costo');
      });
    }
  });
};

