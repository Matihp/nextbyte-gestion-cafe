/**
 * Seeder de Roles del Sistema

 */
const { ROLES_SISTEMA } = require('../../constants/roles');

exports.seed = async function (knex) {
  const roles = [
    {
      id: ROLES_SISTEMA.ADMIN,
      nombre: 'Admin',
      es_admin: true,
      permisos: JSON.stringify(['all'])
    },
    {
      id: ROLES_SISTEMA.PANTALLA_CLIENTE,
      nombre: 'Rol Pantalla Cliente',
      es_admin: false,
      permisos: JSON.stringify(['customerViewer'])
    },
    {
      id: ROLES_SISTEMA.CAJERO_PRINCIPAL,
      nombre: 'Cajero Diario / Principal (opera sin internet)',
      es_admin: false,
      permisos: JSON.stringify(['dashboard', 'orderTaking', 'orders', 'salesReport'])
    },
    {
      id: ROLES_SISTEMA.CAJERO_SECUNDARIO,
      nombre: 'Cajero Secundario (se bloquea en corte de internet)',
      es_admin: false,
      permisos: JSON.stringify(['dashboard', 'orderTaking', 'orders', 'products', 'inventory', 'salesReport'])
    },
    {
      id: 'b745dad6-bff8-455f-ae1d-470f1b55642e',
      nombre: 'Cocina/Cancela Pedido',
      es_admin: false,
      permisos: JSON.stringify(['orders', 'customerViewer', 'cancelOrder'])
    },
    {
      id: '74efc3a9-1aa1-481a-9624-0d13d99624d2',
      nombre: 'Cocina/No Cancela Pedido',
      es_admin: false,
      permisos: JSON.stringify(['orders', 'customerViewer'])
    },
    {
      id: '9e1baa24-3686-4923-b847-fb4c7b863fc6',
      nombre: 'Administracion',
      es_admin: false,
      permisos: JSON.stringify(['dashboard', 'employees', 'suppliers', 'salesReport', 'analytics'])
    }
  ];

  for (const rol of roles) {
    const existe = await knex('roles').where('id', rol.id).orWhere('nombre', rol.nombre).first();
    if (existe) {
      await knex('roles').where('id', existe.id).update({
        nombre: rol.nombre,
        es_admin: rol.es_admin,
        permisos: rol.permisos
      });
    } else {
      await knex('roles').insert(rol);
    }
  }

  // Eliminar roles obsoletos
  await knex('roles').whereIn('nombre', ['Barista', 'Cajero', 'Cocina', 'Mozo', 'dd', 'Rol Cliente']).del();
};
