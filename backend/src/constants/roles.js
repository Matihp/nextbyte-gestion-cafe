/**
 * Identificadores únicos y constantes oficiales de Roles del Sistema
 * Centraliza la única fuente de verdad (Single Source of Truth) evitando Magic Strings y chequeos por nombre.
 */
const ROLES_SISTEMA = {
  ADMIN: '48575788-681d-47dc-b0ed-11cd402ca182',
  PANTALLA_CLIENTE: 'e21a7447-d538-40c2-baf6-68a4b9b98ded',
  CAJERO_PRINCIPAL: '877890f1-ffc8-488b-a5c4-b1caff520383', // Único rol autorizado a operar localmente en contingencia offline
  CAJERO_SECUNDARIO: 'e87f673d-3f35-436f-b49c-409de2476560'
};

// Roles fijos del sistema que nunca pueden ser eliminados
const ROLES_NO_ELIMINABLES = [
  ROLES_SISTEMA.ADMIN,
  ROLES_SISTEMA.PANTALLA_CLIENTE,
  ROLES_SISTEMA.CAJERO_PRINCIPAL,
  ROLES_SISTEMA.CAJERO_SECUNDARIO
];

// Roles con permisos predeterminados e inalterables (nadie puede modificarlos)
const ROLES_PERMISOS_FIJOS = [
  ROLES_SISTEMA.ADMIN,
  ROLES_SISTEMA.PANTALLA_CLIENTE,
  ROLES_SISTEMA.CAJERO_PRINCIPAL
];

module.exports = {
  ROLES_SISTEMA,
  ROLES_NO_ELIMINABLES,
  ROLES_PERMISOS_FIJOS
};

