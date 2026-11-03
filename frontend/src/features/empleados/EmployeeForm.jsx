import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function EmployeeForm({ roles = [], initialData = null, onSave, onCancel }) {
  const [showPassword, setShowPassword] = useState(false);
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
    password: '1234'
  });

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
        roleId: initialData.roleId || initialData.rol_id || (roles[0]?.id || 'role-employee'),
        password: initialData.password || '1234'
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        roleId: roles.find((r) => !r.isAdmin && !r.es_admin)?.id || roles[0]?.id || 'role-employee'
      }));
    }
  }, [initialData, roles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    const newEmployee = {
      ...formData,
      id: initialData?.id || `emp-${Date.now()}`,
      nombre: formData.firstName,
      apellido: formData.lastName,
      telefono: formData.phone,
      foto: formData.photo,
      fecha_nacimiento: formData.birthDate,
      fecha_ingreso: formData.joinDate,
      turno_habitual: formData.usualShift,
      rol_id: formData.roleId
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
                    Apellido
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    name="lastName"
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
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name || role.nombre}
                      </option>
                    ))}
                    {roles.length === 0 && (
                      <>
                        <option value="role-cashier">Cajero</option>
                        <option value="role-kitchen">Cocina</option>
                        <option value="role-admin">Administrador</option>
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
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Contraseña *
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 cursor-pointer"
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
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Turnos por Día (workDayShifts)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 bg-white p-4 border border-gray-300 rounded-lg">
                  {daysList.map((day) => {
                    const currentShift = formData.workDayShifts?.[day] || '';
                    return (
                      <div key={day} className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-700 mb-1">{day}</span>
                        <select
                          value={currentShift}
                          onChange={(e) => handleDayShiftChange(day, e.target.value)}
                          className="border border-gray-300 rounded-md p-2 text-xs focus:border-[#9F4F2F] focus:outline-none focus:ring-1 focus:ring-[#9F4F2F]"
                        >
                          <option value="">No trabaja (S/T)</option>
                          <option value="Turno Mañana">Turno Mañana</option>
                          <option value="Turno Tarde">Turno Tarde</option>
                          <option value="Turno Encargado">Turno Encargado</option>
                          <option value="Turno C.E">Turno C.E</option>
                          <option value="Turno Único">Turno Único</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#9F4F2F] hover:bg-[#8A4326] text-white font-semibold"
            >
              Guardar Empleado
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeForm;

