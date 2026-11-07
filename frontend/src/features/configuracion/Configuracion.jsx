import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Bell, 
  LogOut, 
  Plus, 
  Check, 
  X, 
  Shield, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Edit2,
  Eye, 
  EyeOff,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

import { useAuth } from '@/hooks/useAuth';
import { rolService } from '@/services/rolService';
import { usuarioService } from '@/services/usuarioService';
import { cn } from '@/lib/utils';

export const PERMISSION_LABELS = [
  { key: 'dashboard', label: 'Panel', desc: 'Acceso a la pantalla principal con estadísticas generales' },
  { key: 'orderTaking', label: 'Toma de Pedidos', desc: 'Acceso a la caja para tomar pedidos de clientes' },
  { key: 'orders', label: 'Comandas', desc: 'Visualización y gestión de comandas en preparación' },
  { key: 'cancelOrder', label: 'Cancelar Pedido', desc: 'Permite cancelar un pedido desde la sección Comandas' },
  { key: 'products', label: 'Productos', desc: 'Gestión y visualización de productos del catálogo' },
  { key: 'inventory', label: 'Inventario', desc: 'Control de inventario y niveles de stock' },
  { key: 'analytics', label: 'Estadísticas', desc: 'Reportes y estadísticas del rendimiento del negocio' },
  { key: 'employees', label: 'Empleados', desc: 'Gestión del personal y recursos humanos' },
  { key: 'suppliers', label: 'Proveedores', desc: 'Directorio de proveedores del local' },
  { key: 'salesReport', label: 'Caja', desc: 'Cierres de caja y reportes de ventas' },
  { key: 'customerViewer', label: 'Pantalla Clientes', desc: 'Acceso exclusivo a la pantalla completa de estado de pedidos' },
  { key: 'canCreateRoles', label: 'Crear Roles', desc: 'Gestión de roles del sistema (solo el Admin puede crear roles nuevos)' },
];

export const EMP_PERM_ITEMS = [
  { key: 'dashboard', label: 'VER PANEL' },
  { key: 'orderTaking', label: 'VER TOMA DE PEDIDOS' },
  { key: 'orders', label: 'VER COMANDAS' },
  { key: 'cancelOrder', label: 'CANCELAR PEDIDO', sublabel: '(desde Comandas)' },
  { key: 'products', label: 'VER PRODUCTOS' },
  { key: 'inventory', label: 'VER INVENTARIO' },
  { key: 'analytics', label: 'VER ESTADÍSTICAS' },
  { key: 'employees', label: 'VER EMPLEADOS' },
  { key: 'suppliers', label: 'VER PROVEEDORES' },
  { key: 'salesReport', label: 'VER CAJA' },
  { key: 'customerViewer', label: 'VER PANTALLA CLIENTES' },
  { key: 'canCreateRoles', label: 'ADJUDICAR ROLES', sublabel: '(menos el rol admin)' },
];

const emptyPermissions = {
  dashboard: false,
  orderTaking: false,
  products: false,
  orders: false,
  inventory: false,
  analytics: false,
  settings: true,
  canCreateRoles: false,
  customerViewer: false,
  employees: false,
  suppliers: false,
  salesReport: false,
  cancelOrder: false,
};

const emptyEmpForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  roleId: '',
  permissions: { ...emptyPermissions },
};

import {
  ROLES_SISTEMA,
  isAdminRole,
  isCustomerRole,
  isCajaContingenciaRole,
  isCajaDiariaRole,
  isAdministracionRole,
  hasFixedPermissionsRole,
  isNonDeletableRole,
  isFixedRole,
  getRoleDisplayName
} from '@/constants/roles';

export {
  isAdminRole,
  isCustomerRole,
  isCajaContingenciaRole,
  isCajaDiariaRole,
  isAdministracionRole,
  hasFixedPermissionsRole,
  isNonDeletableRole,
  isFixedRole,
  getRoleDisplayName
};

// Permisos fijos garantizados e inalterables:
// - Admin: todos los 12 permisos activos
// - Rol Pantalla Cliente: únicamente customerViewer activo
// - Caja-Contingencia (cortes internet): Panel, Toma de Pedidos, Comandas y Caja activos
// (Para Caja Diaria, Administracion y Cocina devuelve null porque son 100% modificables)
export const getFixedPermissionsForRole = (role) => {
  if (isAdminRole(role)) {
    const p = { ...emptyPermissions };
    PERMISSION_LABELS.forEach(({ key }) => {
      p[key] = true;
    });
    return p;
  }
  if (isCustomerRole(role)) {
    const p = { ...emptyPermissions };
    p.customerViewer = true;
    return p;
  }
  if (isCajaContingenciaRole(role)) {
    const p = { ...emptyPermissions };
    p.dashboard = true;
    p.orderTaking = true;
    p.orders = true;
    p.salesReport = true;
    return p;
  }
  return null;
};

const normalizePermissions = (raw) => {
  if (!raw) return { ...emptyPermissions };
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [raw];
    }
  } else if (typeof raw === 'object') {
    return { ...emptyPermissions, ...raw };
  }

  const isAll = list.includes('all');
  const res = { ...emptyPermissions };
  PERMISSION_LABELS.forEach(({ key }) => {
    res[key] = isAll || list.includes(key);
  });
  return res;
};

const permissionsToArray = (perms) => {
  return Object.keys(perms).filter((k) => Boolean(perms[k]));
};

export function Configuracion() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('account');

  // Datos reales desde backend (inician vacíos, sin datos mock)
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);

  // Perfil del usuario actual
  const [profile, setProfile] = useState({
    firstName: user?.nombre || '',
    lastName: user?.apellido || '',
    email: user?.email || '',
    password: '',
    photo: user?.foto || '',
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  // Formulario nuevo rol
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState({ ...emptyPermissions, dashboard: true });
  const [creatingRole, setCreatingRole] = useState(false);

  // Formulario nuevo usuario
  const [showAddForm, setShowAddForm] = useState(false);
  const [empForm, setEmpForm] = useState(emptyEmpForm);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingEmpId, setSavingEmpId] = useState(null);

  // Lista editar usuarios
  const [showEditList, setShowEditList] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  const [empEdits, setEmpEdits] = useState({});
  const [savedEmpIds, setSavedEmpIds] = useState(new Set());
  const [showEmpPasswords, setShowEmpPasswords] = useState({});

  // Tab de roles
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [editingRoleNameId, setEditingRoleNameId] = useState(null);
  const [tempRoleName, setTempRoleName] = useState('');
  const [savingRoleName, setSavingRoleName] = useState(false);

  // Modales de confirmación
  const [userToDelete, setUserToDelete] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);

  // Carga inicial desde backend
  const cargarDatos = async () => {
    try {
      const [resRoles, resUsuarios] = await Promise.allSettled([
        rolService.getAll(),
        usuarioService.getAll()
      ]);

      let rolesCargados = [];
      if (resRoles.status === 'fulfilled' && resRoles.value) {
        rolesCargados = Array.isArray(resRoles.value) ? resRoles.value : [];
      }

      let usuariosCargados = [];
      if (resUsuarios.status === 'fulfilled' && resUsuarios.value) {
        usuariosCargados = Array.isArray(resUsuarios.value) ? resUsuarios.value : [];
      }

      setRoles(rolesCargados);
      setUsers(usuariosCargados);
      localStorage.setItem('nextbyte_roles', JSON.stringify(rolesCargados));
      window.dispatchEvent(new CustomEvent('roles-updated', { detail: rolesCargados }));
      if (rolesCargados.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesCargados[0].id);
      }
    } catch (err) {
      console.error('Error al cargar configuración:', err);
    }
  };

  const handleSaveRoleName = async () => {
    if (!editingRoleNameId || !tempRoleName.trim()) {
      toast.error('El nombre del rol no puede estar vacío');
      return;
    }
    const cleanName = tempRoleName.trim();
    setSavingRoleName(true);
    try {
      const targetRole = roles.find((r) => r.id === editingRoleNameId);
      await rolService.update(editingRoleNameId, {
        ...(targetRole || {}),
        nombre: cleanName
      });
      const updatedRoles = roles.map((r) =>
        r.id === editingRoleNameId ? { ...r, nombre: cleanName, name: cleanName } : r
      );
      setRoles(updatedRoles);
      localStorage.setItem('nextbyte_roles', JSON.stringify(updatedRoles));
      window.dispatchEvent(new CustomEvent('roles-updated', { detail: updatedRoles }));
      toast.success(`Rol renombrado a "${cleanName}"`);
      setEditingRoleNameId(null);
      setTempRoleName('');
    } catch (err) {
      console.error('Error al renombrar rol:', err);
      toast.error(err.response?.data?.message || err.message || 'No se pudo actualizar el nombre del rol');
    } finally {
      setSavingRoleName(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        firstName: user.nombre || prev.firstName,
        lastName: user.apellido || prev.lastName,
        email: user.email || prev.email,
        photo: user.foto || prev.photo,
      }));
    }
  }, [user]);

  const canManageEmployees = isAdmin || Boolean(user?.permisos?.includes('canCreateRoles') || user?.permisos?.includes('all'));
  const canManageRoles = isAdmin || Boolean(user?.es_admin || user?.permisos?.includes('canCreateRoles') || user?.permisos?.includes('all'));

  const currentRole = roles.find((r) => r.id === user?.rol_id) || {
    id: 'default',
    name: user?.es_admin ? 'Admin' : 'Personal',
    nombre: user?.es_admin ? 'Admin' : 'Personal',
    isAdmin: Boolean(user?.es_admin)
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const displayRole = canManageRoles ? (selectedRole || currentRole) : currentRole;

  // Roles asignables: no-admin no puede asignar el rol Admin
  const assignableRoles = isAdmin ? roles : roles.filter((r) => !isAdminRole(r));

  // Usuarios editables (el admin principal está protegido y no puede ser editado ni eliminado aquí)
  const editableUsers = users.filter((u) => {
    const uRole = roles.find((r) => r.id === (u.rol_id || u.roleId));
    return !isAdminRole(uRole);
  });

  // Guardar perfil propio
  const handleSaveProfile = async () => {
    try {
      if (user?.id && user.id !== 'dev') {
        await usuarioService.update(user.id, {
          nombre: profile.firstName,
          apellido: profile.lastName,
          foto: profile.photo,
          ...(profile.password ? { contrasena: profile.password } : {})
        });
      }
      setProfileSaved(true);
      toast.success('Perfil actualizado correctamente');
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error('Error al guardar perfil:', err);
      toast.error('No se pudo guardar el perfil');
    }
  };

  // Crear nuevo rol
  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) {
      toast.error('Ingrese el nombre del rol');
      return;
    }

    setCreatingRole(true);
    try {
      const permsArray = permissionsToArray(newRolePermissions);
      const payload = {
        nombre: name,
        es_admin: false,
        permisos: permsArray
      };

      const nuevo = await rolService.create(payload);
      toast.success(`Rol "${name}" creado con éxito`);
      setNewRoleName('');
      setNewRolePermissions({ ...emptyPermissions, dashboard: true });
      setShowRoleForm(false);

      if (nuevo && nuevo.id) {
        setRoles((prev) => {
          const yaExiste = prev.some((r) => r.id === nuevo.id);
          return yaExiste ? prev : [...prev, nuevo];
        });
        setSelectedRoleId(nuevo.id);
      }

      await cargarDatos();
    } catch (err) {
      console.error('Error al crear rol:', err);
      toast.error(err.message || 'Error al crear el rol');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleToggleNewRolePermission = (key) => {
    setNewRolePermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Actualizar permisos de un rol existente (LOS ROLES CON PERMISOS INALTERABLES ESTÁN BLOQUEADOS)
  const handleToggleRolePermission = async (key) => {
    if (!isAdmin || !selectedRole) return;

    if (hasFixedPermissionsRole(selectedRole)) {
      toast.error('Los permisos de este rol son fijos e inalterables');
      return;
    }

    const currentPerms = normalizePermissions(selectedRole.permisos);
    const updatedPerms = { ...currentPerms, [key]: !currentPerms[key] };
    const permsArray = permissionsToArray(updatedPerms);

    try {
      await rolService.update(selectedRole.id, {
        ...selectedRole,
        permisos: permsArray
      });
      setRoles((prev) =>
        prev.map((r) => (r.id === selectedRole.id ? { ...r, permisos: permsArray } : r))
      );
      toast.success('Permisos actualizados');
    } catch (err) {
      console.error('Error al actualizar permisos de rol:', err);
      toast.error('No se pudieron actualizar los permisos');
    }
  };

  const openAddForm = () => {
    setShowEditList(false);
    const isContingenciaOcupado = users.some((u) => {
      if (u.tiene_usuario === false || u.tiene_usuario === 0) return false;
      const ur = roles.find((ro) => ro.id === (u.rol_id || u.roleId));
      return isCajaContingenciaRole(ur) || (u.rol_id || u.roleId) === '877890f1-ffc8-488b-a5c4-b1caff520383';
    });

    const defaultRole = assignableRoles.find((r) => {
      if (hasFixedPermissionsRole(r)) return false;
      if (isCajaContingenciaRole(r) && isContingenciaOcupado) return false;
      return true;
    }) ?? assignableRoles.find((r) => !(isCajaContingenciaRole(r) && isContingenciaOcupado)) ?? assignableRoles[0];

    const fixedPerms = getFixedPermissionsForRole(defaultRole);
    const defaultPerms = fixedPerms || (defaultRole ? normalizePermissions(defaultRole.permisos) : { ...emptyPermissions });

    setEmpForm({
      ...emptyEmpForm,
      roleId: defaultRole?.id ?? '',
      permissions: defaultPerms
    });
    setShowAddForm(true);
  };

  const handleAddFormRoleChange = (roleId) => {
    const role = roles.find((r) => r.id === roleId);
    const fixedPerms = getFixedPermissionsForRole(role);

    setEmpForm((f) => ({
      ...f,
      roleId,
      permissions: fixedPerms || (role ? normalizePermissions(role.permisos) : f.permissions)
    }));
  };

  const toggleAddPerm = (key) => {
    const currentSelectedRole = roles.find((r) => r.id === empForm.roleId);
    if (hasFixedPermissionsRole(currentSelectedRole)) return; // Bloqueado si tiene permisos fijos
    setEmpForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const handleSaveAdd = async () => {
    if (!empForm.firstName || !empForm.email || !empForm.password || !empForm.roleId) {
      toast.error('Por favor complete los campos obligatorios');
      return;
    }

    const role = roles.find((r) => r.id === empForm.roleId);
    const fixedPerms = getFixedPermissionsForRole(role);
    const finalPermissions = fixedPerms ? permissionsToArray(fixedPerms) : permissionsToArray(empForm.permissions);

    setCreatingUser(true);
    try {
      await usuarioService.create({
        nombre: empForm.firstName,
        apellido: empForm.lastName,
        email: empForm.email,
        contrasena: empForm.password,
        rol_id: empForm.roleId,
        permisos: finalPermissions
      });
      toast.success('Usuario creado con éxito');
      setShowAddForm(false);
      setEmpForm(emptyEmpForm);
      await cargarDatos();
    } catch (err) {
      console.error('Error al crear usuario:', err);
      toast.error(err.message || 'Ocurrió un error al guardar el usuario');
    } finally {
      setCreatingUser(false);
    }
  };

  // Lista editar usuarios
  const openEditList = () => {
    setShowAddForm(false);
    const edits = {};
    editableUsers.forEach((u) => {
      const uRole = roles.find((r) => r.id === (u.rol_id || u.roleId));
      const fixedPerms = getFixedPermissionsForRole(uRole);

      edits[u.id] = {
        firstName: u.nombre || u.firstName || '',
        lastName: u.apellido || u.lastName || '',
        displayName: u.nombre_distintivo || u.displayName || '',
        email: u.email || '',
        password: '',
        roleId: u.rol_id || u.roleId || '',
        permissions: fixedPerms || normalizePermissions(u.permisos),
        es_empleado: u.es_empleado
      };
    });
    setEmpEdits(edits);
    setExpandedEmpId(null);
    setSavedEmpIds(new Set());
    setShowEditList((prev) => !prev);
  };

  const toggleExpand = (empId) =>
    setExpandedEmpId((prev) => (prev === empId ? null : empId));

  const setEditField = (empId, field, value) => {
    if (field === 'roleId') {
      const role = roles.find((r) => r.id === value);
      const fixedPerms = getFixedPermissionsForRole(role);

      setEmpEdits((prev) => ({
        ...prev,
        [empId]: {
          ...prev[empId],
          [field]: value,
          permissions: fixedPerms || (role ? normalizePermissions(role.permisos) : prev[empId].permissions)
        }
      }));
    } else {
      setEmpEdits((prev) => ({
        ...prev,
        [empId]: {
          ...prev[empId],
          [field]: value
        }
      }));
    }
  };

  const toggleEditPerm = (empId, key) => {
    const edit = empEdits[empId];
    const role = roles.find((r) => r.id === edit?.roleId);
    if (hasFixedPermissionsRole(role)) return; // Bloqueado si tiene permisos fijos
    setEmpEdits((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        permissions: { ...prev[empId].permissions, [key]: !prev[empId].permissions[key] },
      },
    }));
  };

  const saveEmpEdit = async (userId) => {
    const edit = empEdits[userId];
    if (!edit) return;

    const assignedRole = roles.find((r) => r.id === edit.roleId);
    const fixedPerms = getFixedPermissionsForRole(assignedRole);
    const finalPermissions = fixedPerms ? permissionsToArray(fixedPerms) : permissionsToArray(edit.permissions);

    setSavingEmpId(userId);
    try {
      await usuarioService.update(userId, {
        nombre: edit.firstName,
        apellido: edit.lastName,
        email: edit.email,
        rol_id: edit.roleId,
        permisos: finalPermissions,
        ...(edit.password ? { contrasena: edit.password } : {})
      });

      setSavedEmpIds((prev) => new Set([...prev, userId]));
      toast.success('Cambios guardados con éxito');
      await cargarDatos();

      setTimeout(() => {
        setSavedEmpIds((prev) => {
          const s = new Set(prev);
          s.delete(userId);
          return s;
        });
        setExpandedEmpId((prev) => (prev === userId ? null : prev));
      }, 1000);
    } catch (err) {
      console.error('Error al actualizar usuario:', err);
      toast.error(err.message || 'No se pudo guardar el usuario');
    } finally {
      setSavingEmpId(null);
    }
  };

  // Eliminación de usuario (⚠️ SI ES EMPLEADO DEL COMERCIO, NO SE ELIMINA EL EMPLEADO, SOLO SU ACCESO DE USUARIO)
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await usuarioService.delete(userToDelete.id);
      if (res?.es_empleado) {
        toast.success('Acceso de usuario eliminado. El empleado permanece en el comercio.');
      } else {
        toast.success('Usuario eliminado del sistema');
      }
      setUserToDelete(null);
      await cargarDatos();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      toast.error(err.response?.data?.message || 'No se pudo eliminar el usuario');
    }
  };

  // Eliminar rol personalizado (solo para roles que NO son fijos del sistema)
  const confirmDeleteRole = async () => {
    if (!roleToDelete || isNonDeletableRole(roleToDelete)) return;
    try {
      await rolService.delete(roleToDelete.id);
      toast.success(`Rol "${getRoleDisplayName(roleToDelete)}" eliminado`);
      setRoleToDelete(null);
      await cargarDatos();
    } catch (err) {
      console.error('Error al eliminar rol:', err);
      toast.error(err.response?.data?.message || 'No se pudo eliminar el rol (asegúrese de que no tenga empleados asignados)');
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Contenido Principal (2 columnas en desktop) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Tab: Cuenta ── */}
          {activeTab === 'account' && (
            <>
              {/* Información del Perfil */}
              <Card className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 ring-0">
                <h2 className="text-xl font-bold text-[#4B2B1D] mb-1">Información del Perfil</h2>
                <p className="text-gray-500 text-sm mb-6">Actualiza tu información personal</p>

                <div className="space-y-4">
                  {/* Foto de perfil */}
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Foto de Perfil</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#F3E5DC] flex items-center justify-center text-[#9F4F2F] text-xl font-bold overflow-hidden">
                        {profile.photo ? (
                          <img
                            src={profile.photo}
                            alt="Perfil"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          `${(profile.firstName || 'U').charAt(0)}${(profile.lastName || '').charAt(0)}`.toUpperCase()
                        )}
                      </div>
                      <Input
                        type="text"
                        placeholder="URL de la imagen de perfil..."
                        value={profile.photo || ''}
                        onChange={(e) => setProfile((p) => ({ ...p, photo: e.target.value }))}
                        className="flex-1 !h-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1">Nombre</Label>
                      <Input
                        type="text"
                        value={profile.firstName}
                        onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                        className="w-full !h-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1">Apellido</Label>
                      <Input
                        type="text"
                        value={profile.lastName}
                        onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                        className="w-full !h-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">Email / Nombre de Usuario</Label>
                    <Input
                      type="text"
                      disabled
                      value={profile.email}
                      className="w-full !h-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">El identificador de inicio de sesión no puede modificarse.</p>
                  </div>

                  {isAdmin && (
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</Label>
                      <div className="relative">
                        <Input
                          type={showProfilePassword ? "text" : "password"}
                          placeholder="Dejar en blanco para mantener la actual"
                          value={profile.password}
                          onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
                          className="w-full !h-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowProfilePassword((prev) => !prev)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 !h-8 !w-8 hover:bg-transparent text-gray-500 hover:text-gray-700"
                          tabIndex={-1}
                        >
                          {showProfilePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-1">Rol actual</Label>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F3E5DC] text-[#4B2B1D] rounded-lg text-sm font-medium border border-[#A67C52]/30">
                      {isAdmin && <Shield className="w-4 h-4 text-[#9F4F2F]" />}
                      <span>{getRoleDisplayName(currentRole)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium border-0 cursor-pointer"
                    style={{ backgroundColor: '#9F4F2F' }}
                  >
                    <Check className="w-4 h-4" />
                    {profileSaved ? 'Guardado' : 'Guardar Cambios'}
                  </Button>
                </div>
              </Card>

              {/* Gestión de Usuarios del Sistema (visible para administradores o quienes tengan canCreateRoles) */}
              {canManageEmployees && (
                <Card className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 ring-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#4B2B1D] mb-1">Gestión de Usuarios</h2>
                      <p className="text-gray-500 text-sm">Administra las cuentas de acceso al sistema</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={openAddForm}
                        className="flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-sm font-medium border-0 cursor-pointer"
                        style={{ backgroundColor: '#9F4F2F' }}
                      >
                        <Plus className="w-4 h-4" /> Agregar Usuario
                      </Button>
                      <Button
                        variant="outline"
                        onClick={openEditList}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium cursor-pointer"
                      >
                        Editar Usuarios
                      </Button>
                    </div>
                  </div>

                  {/* Formulario nuevo usuario */}
                  {showAddForm && (
                    <div className="mb-5 p-5 bg-[#F3E5DC] rounded-xl border border-[#F3E5DC]">
                      <h3 className="text-sm font-semibold text-[#4B2B1D] mb-3">Nuevo Usuario del Sistema</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div>
                          <Label className="block text-xs font-medium text-gray-700 mb-1">Nombre</Label>
                          <Input
                            type="text"
                            value={empForm.firstName}
                            onChange={(e) => setEmpForm((f) => ({ ...f, firstName: e.target.value }))}
                            className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-medium text-gray-700 mb-1">Apellido</Label>
                          <Input
                            type="text"
                            value={empForm.lastName}
                            onChange={(e) => setEmpForm((f) => ({ ...f, lastName: e.target.value }))}
                            className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-medium text-gray-700 mb-1">Email / Usuario</Label>
                          <Input
                            type="text"
                            value={empForm.email}
                            onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
                            className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>
                        <div>
                          <Label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</Label>
                          <Input
                            type="password"
                            value={empForm.password}
                            onChange={(e) => setEmpForm((f) => ({ ...f, password: e.target.value }))}
                            className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="block text-xs font-medium text-gray-700 mb-1">Rol</Label>
                          <select
                            value={empForm.roleId}
                            onChange={(e) => handleAddFormRoleChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#A67C52] bg-white text-gray-800"
                          >
                            <option value="">Seleccionar un rol...</option>
                            {assignableRoles.map((r) => {
                              const isContingencia = isCajaContingenciaRole(r);
                              const yaAsignadoAOtro = isContingencia && users.some((u) => {
                                if (u.tiene_usuario === false || u.tiene_usuario === 0) return false;
                                const userRole = roles.find((ro) => ro.id === (u.rol_id || u.roleId));
                                return isCajaContingenciaRole(userRole) || (u.rol_id || u.roleId) === '877890f1-ffc8-488b-a5c4-b1caff520383';
                              });
                              return (
                                <option key={r.id} value={r.id} disabled={yaAsignadoAOtro}>
                                  {getRoleDisplayName(r)} {yaAsignadoAOtro ? '(Ya asignado a otro usuario)' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {!isAdmin && (
                            <p className="text-xs text-gray-400 mt-1">Solo el Admin puede asignar el rol Admin.</p>
                          )}
                        </div>
                      </div>

                      {/* Toggles de permisos (bloqueados solo para roles con permisos fijos) */}
                      {(() => {
                        const currentSelectedRole = roles.find((r) => r.id === empForm.roleId);
                        const isLocked = hasFixedPermissionsRole(currentSelectedRole);
                        const isCajaDia = isCajaDiariaRole(currentSelectedRole);

                        return (
                          <div className="border-t border-stone-300/40 pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-[#4B2B1D] uppercase tracking-wide">
                                Permisos para el Rol:
                              </p>
                              {isLocked && (
                                <span className="text-xs text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 font-semibold">
                                  Permisos fijos de {getRoleDisplayName(currentSelectedRole)} (bloqueados)
                                </span>
                              )}
                              {isCajaDia && (
                                <span className="text-xs text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-300 font-semibold">
                                  Rol Fijo (Permisos 100% modificables)
                                </span>
                              )}
                            </div>
                            <div className="space-y-3">
                              {EMP_PERM_ITEMS.map(({ key, label, sublabel }) => (
                                <div key={key} className="flex items-center justify-between">
                                  <div>
                                    <span className={cn("text-sm font-bold", isLocked ? "text-gray-500" : "text-gray-800")}>
                                      {label}
                                    </span>
                                    {sublabel && <span className="block text-xs text-gray-500">{sublabel}</span>}
                                  </div>
                                  <Switch
                                    checked={Boolean(empForm.permissions[key])}
                                    disabled={isLocked}
                                    onCheckedChange={() => toggleAddPerm(key)}
                                  />
                                </div>
                              ))}
                            </div>
                            {isLocked && (
                              <p className="mt-3 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
                                Los permisos del rol {getRoleDisplayName(currentSelectedRole)} son fijos e inalterables. No está permitido modificar ni quitar permisos a este rol.
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={handleSaveAdd}
                          disabled={creatingUser}
                          className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium border-0 cursor-pointer disabled:opacity-60"
                          style={{ backgroundColor: '#9F4F2F' }}
                        >
                          {creatingUser ? (
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {creatingUser ? 'Guardando...' : 'Guardar'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddForm(false)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de usuarios para editar */}
                  {showEditList && (
                    <div className="space-y-2">
                      {editableUsers.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No hay usuarios para editar.</p>
                      ) : (
                        editableUsers.map((u) => {
                          const edit = empEdits[u.id];
                          const isExpanded = expandedEmpId === u.id;
                          const isSaved = savedEmpIds.has(u.id);
                          const uRole = roles.find((r) => r.id === (u.rol_id || u.roleId));
                          if (!edit) return null;

                          const initials = `${(edit.firstName || 'U').charAt(0)}${(edit.lastName || '').charAt(0)}`.toUpperCase();

                          return (
                            <div key={u.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => toggleExpand(u.id)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#F3E5DC] flex items-center justify-center text-[#9F4F2F] text-sm font-semibold shrink-0">
                                    {initials}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {edit.firstName} {edit.lastName}
                                    </p>
                                    <p className="text-xs text-gray-500">{edit.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="px-2 py-0.5 bg-[#F3E5DC] text-[#9F4F2F] border-0 rounded-full text-xs font-medium">
                                    {getRoleDisplayName(uRole)}
                                  </Badge>
                                  {u.es_empleado ? (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                                      Empleado
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-medium">
                                      Solo Usuario
                                    </span>
                                  )}
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </button>

                              {/* Panel desplegable de edición */}
                              {isExpanded && (
                                <div className="border-t border-gray-100 px-4 py-4 bg-[#F3E5DC]/40">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                      <Label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre</Label>
                                      <Input
                                        type="text"
                                        value={edit.firstName}
                                        onChange={(e) => setEditField(u.id, 'firstName', e.target.value)}
                                        className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="block text-xs font-medium text-gray-700 mb-1.5">Apellido</Label>
                                      <Input
                                        type="text"
                                        value={edit.lastName}
                                        onChange={(e) => setEditField(u.id, 'lastName', e.target.value)}
                                        className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre distintivo</Label>
                                      <Input
                                        type="text"
                                        value={edit.displayName || ''}
                                        onChange={(e) => setEditField(u.id, 'displayName', e.target.value)}
                                        placeholder="Este nombre figurará en la grilla..."
                                        className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="block text-xs font-medium text-gray-700 mb-1.5">Email / Usuario</Label>
                                      <Input
                                        type="email"
                                        value={edit.email}
                                        onChange={(e) => setEditField(u.id, 'email', e.target.value)}
                                        className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <Label className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña</Label>
                                      <div className="relative">
                                        <Input
                                          type={showEmpPasswords[u.id] ? "text" : "password"}
                                          placeholder="Dejar en blanco para mantener"
                                          value={edit.password || ''}
                                          onChange={(e) => setEditField(u.id, 'password', e.target.value)}
                                          className="w-full !h-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white pr-10"
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            setShowEmpPasswords((prev) => ({ ...prev, [u.id]: !prev[u.id] }))
                                          }
                                          className="absolute right-1 top-1/2 -translate-y-1/2 !h-8 !w-8 hover:bg-transparent text-gray-500 hover:text-gray-700"
                                          tabIndex={-1}
                                        >
                                          {showEmpPasswords[u.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Selector de Rol y Permisos (bloqueados solo para roles con permisos fijos) */}
                                  {(() => {
                                    const currentEmpRole = roles.find((r) => r.id === edit.roleId);
                                    const isLocked = hasFixedPermissionsRole(currentEmpRole);
                                    const isCajaDia = isCajaDiariaRole(currentEmpRole);

                                    return (
                                      <>
                                        <div className="mb-4">
                                          <Label className="block text-xs font-medium text-gray-700 mb-1.5">Rol</Label>
                                          <select
                                            value={edit.roleId}
                                            onChange={(e) => setEditField(u.id, 'roleId', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#A67C52] bg-white text-gray-800"
                                          >
                                            <option value="">Seleccionar un rol...</option>
                                            {assignableRoles.map((r) => {
                                              const isContingencia = isCajaContingenciaRole(r);
                                              const yaAsignadoAOtro = isContingencia && users.some((other) => {
                                                if (other.id === u.id) return false;
                                                if (other.tiene_usuario === false || other.tiene_usuario === 0) return false;
                                                const otherRole = roles.find((ro) => ro.id === (other.rol_id || other.roleId));
                                                return isCajaContingenciaRole(otherRole) || (other.rol_id || other.roleId) === '877890f1-ffc8-488b-a5c4-b1caff520383';
                                              });
                                              return (
                                                <option key={r.id} value={r.id} disabled={yaAsignadoAOtro}>
                                                  {getRoleDisplayName(r)} {yaAsignadoAOtro ? '(Ya asignado a otro usuario)' : ''}
                                                </option>
                                              );
                                            })}
                                          </select>
                                          {!isAdmin && (
                                            <p className="text-xs text-gray-400 mt-1">Solo el Admin puede asignar el rol Admin.</p>
                                          )}
                                        </div>

                                        {/* Permisos */}
                                        <div className="border-t border-stone-300/40 pt-3">
                                          <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-bold text-[#4B2B1D] uppercase tracking-wide">
                                              Permisos para el Rol:
                                            </p>
                                            {isLocked && (
                                              <span className="text-xs text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 font-semibold">
                                                Permisos fijos de {getRoleDisplayName(currentEmpRole)} (bloqueados)
                                              </span>
                                            )}
                                            {isCajaDia && (
                                              <span className="text-xs text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-300 font-semibold">
                                                Rol Fijo (Permisos 100% modificables)
                                              </span>
                                            )}
                                          </div>
                                          <div className="space-y-2.5">
                                            {EMP_PERM_ITEMS.map(({ key, label, sublabel }) => (
                                              <div key={key} className="flex items-center justify-between">
                                                <div>
                                                  <span className={cn("text-sm font-bold", isLocked ? "text-gray-500" : "text-gray-800")}>
                                                    {label}
                                                  </span>
                                                  {sublabel && <span className="block text-xs text-gray-500">{sublabel}</span>}
                                                </div>
                                                <Switch
                                                  checked={Boolean(edit.permissions[key])}
                                                  disabled={isLocked}
                                                  onCheckedChange={() => toggleEditPerm(u.id, key)}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                          {isLocked && (
                                            <p className="mt-3 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
                                              Los permisos del rol {getRoleDisplayName(currentEmpRole)} son fijos e inalterables. No pueden modificarse.
                                            </p>
                                          )}
                                        </div>
                                      </>
                                    );
                                  })()}

                                  <div className="flex gap-2 mt-4 justify-between">
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => saveEmpEdit(u.id)}
                                        disabled={savingEmpId === u.id}
                                        className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium border-0 cursor-pointer disabled:opacity-60"
                                        style={{ backgroundColor: '#9F4F2F' }}
                                      >
                                        {savingEmpId === u.id ? (
                                          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                        ) : (
                                          <Check className="w-3.5 h-3.5" />
                                        )}
                                        {isSaved ? 'Guardado' : savingEmpId === u.id ? 'Guardando...' : 'Guardar Cambios'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => toggleExpand(u.id)}
                                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" /> Cerrar
                                      </Button>
                                    </div>
                                    <Button
                                      variant="destructive"
                                      onClick={() => setUserToDelete(u)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}

          {/* ── Tab: Gestión Roles de Usuarios ── */}
          {(activeTab === 'roles' || activeTab === 'notifications') && canManageRoles && (
            <div className="space-y-6">
              {/* Gestión de Roles */}
              <Card className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 ring-0">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-[#4B2B1D] mb-1">Gestión de Roles</h2>
                    <p className="text-gray-500 text-sm">Crea y administra los roles del sistema</p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowRoleForm(true);
                      setNewRolePermissions({ ...emptyPermissions, dashboard: true });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-white rounded-lg transition-colors text-sm font-medium border-0 cursor-pointer"
                    style={{ backgroundColor: '#9F4F2F' }}
                  >
                    <Plus className="w-4 h-4" /> Crear Rol
                  </Button>
                </div>

                {showRoleForm && (
                  <div className="mb-5 p-5 bg-[#F3E5DC] rounded-xl border border-[#F3E5DC]">
                    <h3 className="text-sm font-semibold text-[#4B2B1D] mb-4">Nuevo Rol</h3>
                    <div className="mb-4">
                      <Label className="block text-xs font-medium text-gray-700 mb-1">Nombre del Rol</Label>
                      <Input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateRole();
                          }
                        }}
                        placeholder="ej. Supervisor, Encargado, Gerente..."
                        className="w-full !h-auto px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      />
                    </div>

                    <div className="border-t border-stone-300/40 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-[#4B2B1D] uppercase tracking-wide">
                          Asignar Permisos:
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const todos = {};
                              PERMISSION_LABELS.forEach(({ key }) => { todos[key] = true; });
                              setNewRolePermissions(todos);
                            }}
                            className="text-xs text-[#9F4F2F] hover:underline font-medium cursor-pointer"
                          >
                            Marcar todos
                          </button>
                          <span className="text-xs text-gray-300">•</span>
                          <button
                            type="button"
                            onClick={() => setNewRolePermissions({ ...emptyPermissions })}
                            className="text-xs text-gray-500 hover:underline font-medium cursor-pointer"
                          >
                            Desmarcar todos
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {PERMISSION_LABELS.map(({ key, label, desc }) => (
                          <div key={key} className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{label}</p>
                              <p className="text-xs text-gray-500">{desc}</p>
                            </div>
                            <Switch
                              checked={Boolean(newRolePermissions[key])}
                              onCheckedChange={() => handleToggleNewRolePermission(key)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                      <Button
                        onClick={handleCreateRole}
                        disabled={creatingRole}
                        className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium border-0 cursor-pointer"
                        style={{ backgroundColor: '#9F4F2F' }}
                      >
                        {creatingRole ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Guardar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={creatingRole}
                        onClick={() => {
                          setShowRoleForm(false);
                          setNewRoleName('');
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5">
                  {roles.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No hay roles registrados.</p>
                  ) : (
                    roles.map((role) => {
                      const isAdm = isAdminRole(role);
                      const isCust = isCustomerRole(role);
                      const isCajaCont = isCajaContingenciaRole(role);
                      const isCajaDia = isCajaDiariaRole(role);
                      const isFixedPerms = hasFixedPermissionsRole(role);
                      const isUndeletable = isNonDeletableRole(role);
                      const displayName = getRoleDisplayName(role);

                      // Mensajes de hover para recuadros flotantes
                      let hoverMessage = null;
                      let hoverIsRed = false;

                      if (isCajaDia) {
                        hoverMessage = 'En caso de cortes de internet este rol y todos los demas roles se bloquearan. Solo se podra ingresar con el rol Cajero Diario / Principal (opera sin internet)';
                        hoverIsRed = true;
                      } else if (isCajaCont) {
                        hoverMessage = 'En caso de cortes de internet SOLO se podra ingresar con este rol';
                        hoverIsRed = false;
                      }

                      return (
                        <div key={role.id} className="relative group/role">
                          <div
                            onClick={() => setSelectedRoleId(role.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium shadow-sm transition-all cursor-pointer",
                              selectedRoleId === role.id && "ring-2 ring-[#9F4F2F] border-[#9F4F2F] shadow-md scale-[1.02]",
                              isAdm
                                ? "bg-[#A67C52] text-white border-[#A67C52]"
                                : isCust || isCajaCont || isCajaDia
                                ? "bg-[#F3E5DC] text-[#4B2B1D] border-[#A67C52]/40"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            )}
                          >
                            {isAdm && <Shield className="w-3.5 h-3.5 text-amber-200 shrink-0" />}
                            <span className={cn(hoverMessage && "cursor-help")}>{displayName}</span>

                            {isFixedPerms && !isAdm && (
                              <span className="text-[11px] bg-[#4B2B1D]/10 text-[#4B2B1D] px-1.5 py-0.5 rounded font-semibold">
                                Fijo
                              </span>
                            )}
                            {isCajaDia && (
                              <span className="text-[11px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-semibold">
                                Fijo (Modificable)
                              </span>
                            )}

                            {!isUndeletable && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRoleId(role.id);
                                    setEditingRoleNameId(role.id);
                                    setTempRoleName(role.nombre || role.name || '');
                                  }}
                                  className="text-gray-400 hover:text-[#9F4F2F] transition-colors ml-1 p-0.5 rounded cursor-pointer"
                                  title="Renombrar rol"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoleToDelete(role);
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors ml-0.5 p-0.5 rounded cursor-pointer"
                                  title="Eliminar rol"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Recuadro flotante en hover */}
                          {hoverMessage && (
                            <div
                              className={cn(
                                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/role:block z-50 w-72 p-2.5 rounded-xl shadow-xl text-xs font-semibold leading-relaxed pointer-events-none text-center transition-all animate-in fade-in zoom-in-95",
                                hoverIsRed
                                  ? "bg-red-600 text-white border border-red-700 shadow-red-900/30"
                                  : "bg-[#4B2B1D] text-white border border-[#3a2216] shadow-black/30"
                              )}
                            >
                              {hoverMessage}
                              <div
                                className={cn(
                                  "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent",
                                  hoverIsRed ? "border-t-red-600" : "border-t-[#4B2B1D]"
                                )}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Permisos por Rol */}
              <Card className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 ring-0">
                <h2 className="text-xl font-bold text-[#4B2B1D] mb-1">Permisos por Rol</h2>
                <p className="text-gray-500 text-sm mb-5">
                  Configura qué secciones puede ver cada rol
                </p>

                <div className="mb-5 flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="block text-sm font-medium text-gray-700 mb-2">Configurar rol:</Label>
                    <select
                      value={selectedRoleId}
                      onChange={(e) => {
                        setSelectedRoleId(e.target.value);
                        setEditingRoleNameId(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#A67C52] bg-white text-gray-800"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {getRoleDisplayName(r)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isNonDeletableRole(displayRole) && editingRoleNameId !== displayRole?.id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingRoleNameId(displayRole?.id);
                        setTempRoleName(displayRole?.nombre || displayRole?.name || '');
                      }}
                      className="flex items-center gap-1.5 text-xs border-gray-300 text-gray-700 hover:bg-gray-50 h-[38px] cursor-pointer"
                      title="Editar nombre del rol"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                      Renombrar
                    </Button>
                  )}

                  {editingRoleNameId === displayRole?.id && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={tempRoleName}
                        onChange={(e) => setTempRoleName(e.target.value)}
                        placeholder="Nuevo nombre..."
                        className="text-xs h-[38px] w-48"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRoleName();
                          if (e.key === 'Escape') setEditingRoleNameId(null);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingRoleName}
                        onClick={handleSaveRoleName}
                        className="bg-[#9F4F2F] hover:bg-[#803F25] text-white text-xs h-[38px] cursor-pointer"
                        title="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRoleNameId(null)}
                        className="text-xs h-[38px] cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {PERMISSION_LABELS.map(({ key, label, desc }) => {
                    const fixedPerms = getFixedPermissionsForRole(displayRole);
                    const isRoleLocked = Boolean(fixedPerms);
                    const currentPerms = fixedPerms || (displayRole ? normalizePermissions(displayRole.permisos) : { ...emptyPermissions });
                    const isEnabled = Boolean(currentPerms[key]);

                    return (
                      <div key={key} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{label}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          disabled={isRoleLocked}
                          onCheckedChange={() => handleToggleRolePermission(key)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Avisos explicativos según el rol seleccionado */}
                {hasFixedPermissionsRole(displayRole) && (
                  <p className="mt-4 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Los permisos del rol <strong>{getRoleDisplayName(displayRole)}</strong> son predeterminados e inalterables. No pueden modificarse ni eliminarse.
                    </span>
                  </p>
                )}

                {isCajaDiariaRole(displayRole) && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">
                        En caso de cortes de internet este rol y todos los demas roles se bloquearan. Solo se podra ingresar con el rol Cajero Diario / Principal (opera sin internet).
                      </p>
                      <p className="text-red-700 mt-1 font-normal">
                        Este rol es fijo en el sistema (no puede eliminarse), pero sus permisos para las pantallas son 100% configurables.
                      </p>
                    </div>
                  </div>
                )}

                {isCajaContingenciaRole(displayRole) && (
                  <div className="mt-4 p-3 bg-[#F3E5DC] border border-[#A67C52]/40 rounded-xl text-xs text-[#4B2B1D] flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[#9F4F2F] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#4B2B1D]">
                        En caso de cortes de internet SOLO se podra ingresar con este rol.
                      </p>
                      <p className="text-stone-600 mt-1 font-normal">
                        Permisos predeterminados e inalterables: Panel, Toma de Pedidos, Comandas y Caja.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        {/* ── Barra Lateral Derecha (Preferencias y Salir) ── */}
        <div className="space-y-6">
          <Card className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-0 ring-0">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Preferencias</h3>
            </div>
            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                  activeTab === 'account'
                    ? "text-[#9F4F2F] bg-[#F3E5DC]"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <User className="w-4 h-4" /> Cuenta
              </button>

              {canManageRoles && (
                <button
                  type="button"
                  onClick={() => setActiveTab('roles')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                    (activeTab === 'roles' || activeTab === 'notifications')
                      ? "text-[#9F4F2F] bg-[#F3E5DC]"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Shield className="w-4 h-4" /> Gestión Roles de Usuarios
                </button>
              )}
            </div>
          </Card>

          <Card className="bg-red-50 rounded-xl border border-red-100 p-4 ring-0">
            <h3 className="text-sm font-semibold text-red-800 mb-2">Salir del sistema</h3>
            <p className="text-xs text-red-600 mb-4">
              Cerrarás tu sesión y serás redirigido a la pantalla de inicio de sesión.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Cerrar Sesión
            </Button>
          </Card>
        </div>
      </div>

      {/* Modal de confirmación para eliminar usuario del sistema */}
      <Dialog open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="sm:max-w-[440px] bg-white rounded-2xl border border-gray-200 p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#4B2B1D]">
              ¿Eliminar usuario del sistema?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2 space-y-2">
              <p>
                Esta acción revocará y eliminará el acceso de usuario de{' '}
                <span className="font-semibold text-[#4B2B1D]">
                  {userToDelete?.nombre || userToDelete?.firstName || ''} {userToDelete?.apellido || userToDelete?.lastName || ''}
                </span>{' '}
                al sistema.
              </p>
              {userToDelete?.es_empleado ? (
                <span className="block font-medium text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-xs">
                  ℹ️ Este usuario es también un <strong>empleado del comercio</strong>. Al eliminar este usuario solo se le quitará el acceso al sistema; su registro como empleado del comercio <strong>NO</strong> será eliminado.
                </span>
              ) : (
                <span className="block text-gray-500 text-xs bg-gray-50 p-2 rounded-lg border border-gray-200">
                  Este usuario del sistema no figura como empleado del comercio y su cuenta será eliminada por completo.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserToDelete(null)}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteUser}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              Eliminar Acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar rol personalizado */}
      <Dialog open={Boolean(roleToDelete)} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <DialogContent className="sm:max-w-[425px] bg-white rounded-2xl border border-gray-200 p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#4B2B1D]">
              ¿Eliminar rol?
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2">
              Esta acción no se puede deshacer. Se eliminará el rol{' '}
              <span className="font-semibold text-[#4B2B1D]">
                {getRoleDisplayName(roleToDelete)}
              </span>{' '}
              del sistema. Asegúrese de que no haya usuarios asignados a este rol.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleToDelete(null)}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteRole}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              Eliminar Rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Configuracion;
