/**
 * Seeder de Usuarios Iniciales
 * Define el Admin inicial y el Cajero de Contingencia inicial a partir de variables de entorno (.env).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const { ROLES_SISTEMA } = require('../../constants/roles');

exports.seed = async function (knex) {
  const emailAdmin = process.env.ADMIN_EMAIL || 'admin@nextbyte.com';
  const contrasenaAdmin = process.env.ADMIN_PASSWORD || 'admin123';
  const emailCaja = process.env.CONTINGENCIA_EMAIL || 'caja@nextbyte.com';
  const contrasenaCaja = process.env.CONTINGENCIA_PASSWORD || 'caja123';

  const usuarios = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      legajo: 'ADM-001',
      nombre: 'Admin',
      apellido: 'Sistema',
      email: emailAdmin,
      contrasena: bcrypt.hashSync(contrasenaAdmin, 10),
      rol_id: ROLES_SISTEMA.ADMIN,
      permisos: JSON.stringify(['all']),
      es_empleado: 0,
      tiene_usuario: 1
    },
    // {
    //   id: '22222222-2222-2222-2222-222222222222',
    //   legajo: 'CAJ-CONT-001',
    //   nombre: 'Cajero',
    //   apellido: 'Principal',
    //   email: emailCaja,
    //   contrasena: bcrypt.hashSync(contrasenaCaja, 10),
    //   rol_id: '877890f1-ffc8-488b-a5c4-b1caff520383',
    //   permisos: JSON.stringify(['dashboard', 'orderTaking', 'orders', 'salesReport']),
    //   es_empleado: 1,
    //   tiene_usuario: 1
    // }
  ];

  for (const usuario of usuarios) {
    const existe = await knex('empleados')
      .where('id', usuario.id)
      .orWhere('email', usuario.email)
      .first();

    if (existe) {
      await knex('empleados').where('id', existe.id).update({
        legajo: usuario.legajo,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        contrasena: usuario.contrasena,
        rol_id: usuario.rol_id,
        permisos: usuario.permisos,
        es_empleado: usuario.es_empleado,
        tiene_usuario: usuario.tiene_usuario
      });
    } else {
      await knex('empleados').insert(usuario);
    }
  }
};
