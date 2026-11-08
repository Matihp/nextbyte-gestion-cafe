/**
 * Identificadores únicos y constantes oficiales de Roles del Sistema (Frontend)
 */
export const ROLES_SISTEMA = {
  ADMIN: '48575788-681d-47dc-b0ed-11cd402ca182',
  PANTALLA_CLIENTE: 'e21a7447-d538-40c2-baf6-68a4b9b98ded',
  CAJERO_PRINCIPAL: '877890f1-ffc8-488b-a5c4-b1caff520383', // Único rol autorizado a operar localmente en contingencia offline
  CAJERO_SECUNDARIO: 'e87f673d-3f35-436f-b49c-409de2476560',
  ADMINISTRACION: '9e1baa24-3686-4923-b847-fb4c7b863fc6'
};

export const ROLES_NO_ELIMINABLES = [
  ROLES_SISTEMA.ADMIN,
  ROLES_SISTEMA.PANTALLA_CLIENTE,
  ROLES_SISTEMA.CAJERO_PRINCIPAL,
  ROLES_SISTEMA.CAJERO_SECUNDARIO
];

export const ROLES_PERMISOS_FIJOS = [
  ROLES_SISTEMA.ADMIN,
  ROLES_SISTEMA.PANTALLA_CLIENTE,
  ROLES_SISTEMA.CAJERO_PRINCIPAL
];

export const isAdminRole = (role) => {
  if (!role) return false;
  return Boolean(role.es_admin || role.isAdmin || role.id === ROLES_SISTEMA.ADMIN || role.id === 'role-admin');
};

export const isCustomerRole = (role) => {
  if (!role) return false;
  return role.id === ROLES_SISTEMA.PANTALLA_CLIENTE || role.id === 'role-customer';
};

export const isCajaContingenciaRole = (role) => {
  if (!role) return false;
  return role.id === ROLES_SISTEMA.CAJERO_PRINCIPAL || role.id === 'role-caja-contingencia';
};

export const isCajaDiariaRole = (role) => {
  if (!role) return false;
  return role.id === ROLES_SISTEMA.CAJERO_SECUNDARIO || role.id === 'role-caja-diaria';
};

export const isAdministracionRole = (role) => {
  if (!role) return false;
  if (role.id === ROLES_SISTEMA.ADMINISTRACION || role.id === 'role-administracion') return true;
  const name = String(role.nombre || role.name || '').trim().toLowerCase();
  return (
    name === 'administracion' ||
    name === 'administración' ||
    name === 'tareas administrativas' ||
    name === 'tareas administrtivas'
  );
};

// Roles con permisos predeterminados e inalterables (nadie puede cambiarles los permisos)
export const hasFixedPermissionsRole = (role) => {
  return isAdminRole(role) || isCustomerRole(role) || isCajaContingenciaRole(role);
};

// Roles fijos del sistema que NO pueden ser eliminados por nadie
export const isNonDeletableRole = (role) => {
  return (
    isAdminRole(role) ||
    isCustomerRole(role) ||
    isCajaContingenciaRole(role) ||
    isCajaDiariaRole(role)
  );
};

export const isFixedRole = (role) => hasFixedPermissionsRole(role);

export const getRoleDisplayName = (role) => {
  if (!role) return 'Sin rol';
  if (isAdminRole(role)) return 'Admin';
  if (isCustomerRole(role)) return 'Rol Pantalla Cliente';
  if (isCajaContingenciaRole(role)) return 'Cajero Diario / Principal (opera sin internet)';
  if (isCajaDiariaRole(role)) return 'Cajero Secundario (se bloquea en corte de internet)';
  if (isAdministracionRole(role)) return 'Tareas Administrativas';
  return role.nombre || role.name || 'Sin rol';
};

export const OFFICIAL_SYSTEM_ROLES = [
  { id: ROLES_SISTEMA.ADMIN, nombre: 'Admin', name: 'Admin', es_admin: true, isAdmin: true },
  { id: ROLES_SISTEMA.CAJERO_PRINCIPAL, nombre: 'Cajero Diario / Principal (opera sin internet)', name: 'Cajero Diario / Principal (opera sin internet)', es_admin: false, isAdmin: false },
  { id: ROLES_SISTEMA.CAJERO_SECUNDARIO, nombre: 'Cajero Secundario (se bloquea en corte de internet)', name: 'Cajero Secundario (se bloquea en corte de internet)', es_admin: false, isAdmin: false },
  { id: 'b745dad6-bff8-455f-ae1d-470f1b55642e', nombre: 'Cocina/Cancela Pedido', name: 'Cocina/Cancela Pedido', es_admin: false, isAdmin: false },
  { id: '74efc3a9-1aa1-481a-9624-0d13d99624d2', nombre: 'Cocina/No Cancela Pedido', name: 'Cocina/No Cancela Pedido', es_admin: false, isAdmin: false },
  { id: ROLES_SISTEMA.ADMINISTRACION, nombre: 'Tareas Administrativas', name: 'Tareas Administrativas', es_admin: false, isAdmin: false },
  { id: ROLES_SISTEMA.PANTALLA_CLIENTE, nombre: 'Rol Pantalla Cliente', name: 'Rol Pantalla Cliente', es_admin: false, isAdmin: false }
];
