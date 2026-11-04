/**
 * Seeder de Roles del Sistema
 * Define los roles fijos inalterables (Admin, Rol Pantalla Cliente, Caja-Contingencia),
 * el rol fijo no eliminable pero modificable (Caja Diaria)
 * y los roles operativos/administrativos modificables y eliminables (Cocina, Administración).
 */
exports.seed = async function (knex) {
  const roles = [
    {
      id: '48575788-681d-47dc-b0ed-11cd402ca182',
      nombre: 'Admin',
      es_admin: true,
      permisos: JSON.stringify(['all'])
    },
    {
      id: 'e21a7447-d538-40c2-baf6-68a4b9b98ded',
      nombre: 'Rol Pantalla Cliente',
      es_admin: false,
      permisos: JSON.stringify(['customerViewer'])
    },
    {
      id: '877890f1-ffc8-488b-a5c4-b1caff520383',
      nombre: 'Caja-Contingencia (cortes internet)',
      es_admin: false,
      permisos: JSON.stringify(['dashboard', 'orderTaking', 'orders', 'salesReport'])
    },
    {
      id: 'e87f673d-3f35-436f-b49c-409de2476560',
      nombre: 'Caja Diaria (se bloquea en corte de internet)',
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
