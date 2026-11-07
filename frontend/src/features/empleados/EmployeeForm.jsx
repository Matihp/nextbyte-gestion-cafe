import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  ROLES_SISTEMA,
  getRoleDisplayName,
  isCajaContingenciaRole,
  isAdminRole,
  isAdministracionRole,
  isCajaDiariaRole
} from '@/constants/roles';

export function EmployeeForm({ roles = [], initialData = null, existingEmployees = [], onSave, onCancel }) {
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    legajo: '',
    email: '',
    phone: '',
    birthDate: '',
    joinDate: '',
    usualShift: 'Turno Mañana',
    workDays: [],
    workDayShifts: {},
    photo: '',
    roleId: '',
    password: '123456'
  });

  const isContingenciaYaAsignado = (role) => {
    if (!isCajaContingenciaRole(role)) return false;
    return existingEmployees.some((emp) => {
      if (initialData && (emp.id === initialData.id || emp.id === initialData.empleado_id)) {
        return false;
      }
      if (emp.tiene_usuario === false || emp.tiene_usuario === 0) {
        return false;
      }
      const empRoleId = emp.roleId || emp.rol_id;
      const empRole = roles.find((r) => r.id === empRoleId);
      return empRoleId === role.id || isCajaContingenciaRole(empRole) || empRoleId === ROLES_SISTEMA.CAJERO_PRINCIPAL;
    });
  };

  const resolveRoleId = (rawRoleId) => {
    if (!rawRoleId) return '';
    const found = roles.find((r) => r.id === rawRoleId);
    if (found) return found.id;
    if (rawRoleId === 'role-administracion') {
      return roles.find((r) => isAdministracionRole(r))?.id || rawRoleId;
    }
    if (rawRoleId === 'role-caja-contingencia') {
      return roles.find((r) => isCajaContingenciaRole(r))?.id || rawRoleId;
    }
    if (rawRoleId === 'role-caja-diaria') {
      return roles.find((r) => isCajaDiariaRole(r))?.id || rawRoleId;
    }
    if (rawRoleId === 'role-admin') {
      return roles.find((r) => isAdminRole(r))?.id || rawRoleId;
    }
    return rawRoleId;
  };

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || initialData.nombre || '',
        lastName: initialData.lastName || initialData.apellido || '',
        displayName: initialData.displayName || '',
        legajo: initialData.legajo || '',
        email: initialData.email || '',
        phone: initialData.phone || initialData.telefono || '',
        birthDate: initialData.birthDate || initialData.fecha_nacimiento || '',
        joinDate: initialData.joinDate || initialData.fecha_ingreso || '',
        usualShift: initialData.usualShift || initialData.turno_habitual || 'Turno Mañana',
        workDays: initialData.workDays || initialData.work_days || [],
        workDayShifts: initialData.workDayShifts || initialData.work_day_shifts || initialData.dias_franco_turnos || {},
        photo: initialData.photo || initialData.foto || '',
        roleId: resolveRoleId(initialData.roleId || initialData.rol_id) || (roles[0]?.id || ''),
        password: initialData.password || '123456'
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        roleId: prev.roleId && roles.some((r) => r.id === prev.roleId)
          ? prev.roleId
          : roles.find((r) => !isAdminRole(r) && !isContingenciaYaAsignado(r))?.id || roles[0]?.id || ''
      }));
    }
  }, [initialData, roles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'email') {
      const emailVal = value.trim().toLowerCase();
      const isDup = existingEmployees.some(
        (emp) =>
          (emp.email || '').toLowerCase().trim() === emailVal &&
          (!initialData || (emp.id !== initialData.id && emp.id !== initialData.empleado_id))
      );
      if (isDup && emailVal) {
        setEmailError('Ya existe un empleado registrado con este email');
      } else {
        setEmailError('');
      }
    }
  };

  const handleDayShiftChange = (day, val) => {
    setFormData((prev) => {
      const currentShifts = { ...(prev.workDayShifts || {}) };
      if (val) {
        currentShifts[day] = val;
      } else {
        delete currentShifts[day];
      }

      const newWorkDays = Object.keys(currentShifts);
      const firstShift = Object.values(currentShifts)[0] || prev.usualShift || 'Turno Mañana';

      return {
        ...prev,
        workDayShifts: currentShifts,
        workDays: newWorkDays,
        usualShift: firstShift
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.email) return;

    const emailLimpio = formData.email.trim().toLowerCase();
    const isDup = existingEmployees.some(
      (emp) =>
        (emp.email || '').toLowerCase().trim() === emailLimpio &&
        (!initialData || (emp.id !== initialData.id && emp.id !== initialData.empleado_id))
    );

    if (isDup) {
      setEmailError('Ya existe un empleado registrado con este email');
      toast.error('Ya existe un empleado registrado con ese email.');
      return;
    }

    const nombreLimpio = formData.firstName.trim();
    const apellidoLimpio = (formData.lastName || '').trim() || nombreLimpio;
    const legajoLimpio = (formData.legajo || '').trim() || String(Math.floor(1000 + Math.random() * 9000));
    const passLimpio = formData.password && formData.password.length >= 6 ? formData.password : '123456';

    const newEmployee = {
      ...formData,
      id: initialData?.id,
      firstName: nombreLimpio,
      lastName: apellidoLimpio,
      nombre: nombreLimpio,
      apellido: apellidoLimpio,
      displayName: (formData.displayName || `${nombreLimpio} ${apellidoLimpio}`).trim(),
      legajo: legajoLimpio,
      email: formData.email.trim(),
      password: passLimpio,
      contrasena: passLimpio,
      telefono: formData.phone?.trim() || null,
      foto: formData.photo?.trim() || null,
      fecha_nacimiento: formData.birthDate || null,
      fecha_ingreso: formData.joinDate || null,
      turno_habitual: formData.usualShift || 'Turno Mañana',
      dias_franco: Array.isArray(formData.workDays) ? formData.workDays : [],
      rol_id: formData.roleId || null
    };

    if (onSave) {
      onSave(newEmployee);
    }
  };

  const daysList = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <div className="flex-1 bg-white rounded-xl shadow-sm p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-[#4B2B1D] mb-6">
          {initialData ? 'Editar Empleado' : 'Agregar Nuevo Empleado'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información Básica */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#70422B] border-b pb-2">Información Básica</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                    Nombre *
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                    Apellido *
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="displayName" className="text-sm font-medium text-gray-700">
                  Nombre distintivo
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  placeholder="Este nombre figurará en la grilla..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="legajo" className="text-sm font-medium text-gray-700">
                    Legajo
                  </Label>
                  <Input
                    id="legajo"
                    type="text"
                    name="legajo"
                    value={formData.legajo}
                    onChange={handleChange}
                    placeholder="Ej: 1001"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="roleId" className="text-sm font-medium text-gray-700">
                    Rol
                  </Label>
                  <select
                    id="roleId"
                    name="roleId"
                    value={formData.roleId}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-[#9F4F2F] focus:outline-none focus:ring-1 focus:ring-[#9F4F2F]"
                  >
                    {roles.map((role) => {
                      const yaAsignado = isContingenciaYaAsignado(role);
                      const displayName = getRoleDisplayName(role);
                      return (
                        <option key={role.id} value={role.id} disabled={yaAsignado}>
                          {displayName} {yaAsignado ? '(Ya asignado a otro usuario)' : ''}
                        </option>
                      );
                    })}
                    {roles.length === 0 && (
                      <>
                        <option value="">Sin rol asignado</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="photo" className="text-sm font-medium text-gray-700">
                  URL de la Foto
                </Label>
                <Input
                  id="photo"
                  type="text"
                  name="photo"
                  placeholder="https://..."
                  value={formData.photo}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="birthDate" className="text-sm font-medium text-gray-700">
                    Fecha de Nacimiento
                  </Label>
                  <Input
                    id="birthDate"
                    type="date"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="joinDate" className="text-sm font-medium text-gray-700">
                    Fecha de Ingreso
                  </Label>
                  <Input
                    id="joinDate"
                    type="date"
                    name="joinDate"
                    value={formData.joinDate}
                    onChange={handleChange}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Contacto y Operativa */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#70422B] border-b pb-2">Contacto y Operativa</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={`mt-1 ${emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  {emailError && (
                    <p className="text-xs text-red-600 mt-1 font-medium">{emailError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Contraseña * (mínimo 6 caracteres)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={handleChange}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  type="text"
                  name="phone"
                  placeholder="11-1234-5678"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

              {/* Días y Turnos de Trabajo */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Días y Turnos de Trabajo
                </Label>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  {daysList.map((day) => {
                    const isSelected = Boolean(formData.workDayShifts[day]);
                    const currentShift = formData.workDayShifts[day] || 'Turno Mañana';

                    return (
                      <div key={day} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              handleDayShiftChange(day, e.target.checked ? currentShift : null);
                            }}
                            className="rounded border-gray-300 text-[#9F4F2F] focus:ring-[#9F4F2F]"
                          />
                          <span className={isSelected ? 'font-medium text-gray-900' : 'text-gray-500'}>
                            {day}
                          </span>
                        </label>

                        {isSelected && (
                          <select
                            value={currentShift}
                            onChange={(e) => handleDayShiftChange(day, e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#9F4F2F]"
                          >
                            <option value="Turno Mañana">Turno Mañana</option>
                            <option value="Turno Tarde">Turno Tarde</option>
                            <option value="Turno Encargado">Turno Encargado</option>
                            <option value="Turno C.E">Turno C.E</option>
                            <option value="Turno Único">Turno Único</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="px-6 cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="px-6 bg-[#9F4F2F] hover:bg-[#8A4326] text-white cursor-pointer"
            >
              {initialData ? 'Guardar Cambios' : 'Registrar Empleado'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeForm;
