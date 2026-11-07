/**
 * Migración para actualizar el nombre del rol Administracion a Tareas Administrativas
 * y sincronizar nombres oficiales de roles del sistema.
 */
exports.up = async function (knex) {
  // 1. Actualizar el rol 'Administracion' a 'Tareas Administrativas'
  await knex('roles')
    .where('id', '9e1baa24-3686-4923-b847-fb4c7b863fc6')
    .orWhere('nombre', 'Administracion')
    .orWhere('nombre', 'Administración')
    .update({ nombre: 'Tareas Administrativas' });

  // 2. Normalizar nombres oficiales de cajeros
  await knex('roles')
    .where('id', '877890f1-ffc8-488b-a5c4-b1caff520383')
    .orWhere('nombre', 'Caja-Contingencia (cortes internet)')
    .update({ nombre: 'Cajero Diario / Principal (opera sin internet)' });

  await knex('roles')
    .where('id', 'e87f673d-3f35-436f-b49c-409de2476560')
    .orWhere('nombre', 'Caja Diaria (se bloquea en corte de internet)')
    .update({ nombre: 'Cajero Secundario (se bloquea en corte de internet)' });

  // 3. Eliminar roles obsoletos si existen
  await knex('roles')
    .whereIn('nombre', ['Barista', 'Cajero', 'Cocina', 'Mozo', 'dd', 'Rol Cliente'])
    .del();
};

exports.down = async function (knex) {
  await knex('roles')
    .where('id', '9e1baa24-3686-4923-b847-fb4c7b863fc6')
    .update({ nombre: 'Administracion' });
};

