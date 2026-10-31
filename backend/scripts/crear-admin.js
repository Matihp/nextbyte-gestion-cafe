const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rolRepository = require('../src/repositories/rolRepository');
const empleadoRepository = require('../src/repositories/empleadoRepository');
const { dbLocal } = require('../src/config/db');

const emailAdmin = process.env.ADMIN_EMAIL;
const contrasenaAdmin = process.env.ADMIN_PASSWORD;

const main = async () => {
  try {
    let rol = await rolRepository.getByName('Administrador');
    if (!rol) {
      rol = await rolRepository.create({
        id: crypto.randomUUID(),
        nombre: 'Administrador',
        es_admin: true,
        permisos: ['all']
      });
      console.log('Rol Administrador creado');
    } else {
      console.log('El rol Administrador ya existe');
    }

    let admin = await empleadoRepository.getByEmail(emailAdmin);
    if (!admin) {
      const contrasenaHash = await bcrypt.hash(contrasenaAdmin, 10);
      admin = await empleadoRepository.create({
        id: crypto.randomUUID(),
        rol_id: rol.id,
        legajo: 'ADM-001',
        nombre: 'Admin',
        apellido: 'Sistema',
        email: emailAdmin,
        contrasena: contrasenaHash,
        permisos: ['all']
      });
      console.log('Empleado administrador creado');
    } else {
      console.log('El empleado administrador ya existe');
    }
  } finally {
    await dbLocal.destroy();
  }
};

main().catch((error) => {
  console.error('Error al crear usuario administrador:', error.message);
  process.exit(1);
});
