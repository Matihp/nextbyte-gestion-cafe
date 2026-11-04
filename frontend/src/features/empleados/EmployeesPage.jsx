import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { EmployeeList } from './EmployeeList';
import { EmployeeForm } from './EmployeeForm';
import { RotationGrid } from './RotationGrid';
import { MiniCalendar } from './MiniCalendar';
import { MetricsPanel } from './MetricsPanel';
import { empleadoService } from '@/services/empleadoService';
import { turnoService } from '@/services/turnoService';
import { rolService } from '@/services/rolService';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

const INITIAL_ROLES = [
  { id: 'role-admin', name: 'Administrador', isAdmin: true },
  { id: 'role-cashier', name: 'Cajero', isAdmin: false },
  { id: 'role-kitchen', name: 'Cocina', isAdmin: false }
];

const INITIAL_EMPLOYEES = [];

// Conversión de estado visual de turno a los estados de backend permitidos ('presente', 'ausente', 'franco', 'licencia', 'tarde')
const shiftToBackendStatus = (uiStatus) => {
  const s = String(uiStatus || '').toUpperCase().trim();
  if (s.includes('FRANCO')) return 'franco';
  if (s.includes('AUSENTE')) return 'ausente';
  if (s.includes('LICENCIA') || s.includes('VACACIONES')) return 'licencia';
  if (s.includes('TARDE')) return 'tarde';
  return 'presente';
};

// Conversión de estado de backend a etiqueta visual para la grilla
const backendToUiShiftStatus = (backendStatus, usualShift = 'Turno Mañana') => {
  const s = String(backendStatus || '').toLowerCase().trim();
  if (s === 'franco') return 'FRANCO';
  if (s === 'ausente') return 'AUSENTE';
  if (s === 'licencia') return 'LICENCIA';
  if (s === 'tarde') return 'Turno Tarde';
  if (s === 'presente') return usualShift || 'Turno Mañana';
  return usualShift || 'Turno Mañana';
};

export function EmployeesPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMetrics, setShowMetrics] = useState(false);
  const [currentView, setCurrentView] = useState('grid');
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [roles, setRoles] = useState(() => {
    try {
      const saved = localStorage.getItem('nextbyte_roles');
      return saved ? JSON.parse(saved) : INITIAL_ROLES;
    } catch {
      return INITIAL_ROLES;
    }
  });

  const [employees, setEmployees] = useState(() => {
    try {
      const saved = localStorage.getItem('nextbyte_employees');
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [shifts, setShifts] = useState(() => {
    try {
      const saved = localStorage.getItem('nextbyte_shifts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Guardar en localStorage ante cambios
  useEffect(() => {
    localStorage.setItem('nextbyte_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('nextbyte_shifts', JSON.stringify(shifts));
  }, [shifts]);

  // Carga e integración en vivo con la base de datos (Backend Dev 2)
  useEffect(() => {
    const loadBackendData = async () => {
      try {
        const [empRes, rolRes, turnoRes] = await Promise.allSettled([
          empleadoService.obtenerTodos(),
          rolService.obtenerTodos(),
          turnoService.obtenerTodos()
        ]);

        if (rolRes.status === 'fulfilled') {
          const rawRoles = rolRes.value;
          const loadedRoles = Array.isArray(rawRoles)
            ? rawRoles
            : rawRoles?.data?.data || rawRoles?.data || [];
          if (Array.isArray(loadedRoles) && loadedRoles.length > 0) {
            setRoles(loadedRoles);
            localStorage.setItem('nextbyte_roles', JSON.stringify(loadedRoles));
          }
        }

        if (empRes.status === 'fulfilled') {
          const rawEmps = empRes.value;
          const loadedEmps = Array.isArray(rawEmps)
            ? rawEmps
            : rawEmps?.data?.data || rawEmps?.data || [];
          if (Array.isArray(loadedEmps)) {
            const mapped = loadedEmps.map((e) => ({
              ...e,
              firstName: e.nombre || e.firstName,
              lastName: e.apellido || e.lastName,
              displayName: e.displayName || `${e.nombre || ''} ${e.apellido || ''}`.trim(),
              usualShift: e.turno_habitual || e.usualShift || 'Turno Mañana',
              workDayShifts:
                e.workDayShifts ||
                (typeof e.dias_franco === 'object' && !Array.isArray(e.dias_franco)
                  ? e.dias_franco
                  : {}),
              workDays: Array.isArray(e.dias_franco)
                ? e.dias_franco
                : Object.keys(e.workDayShifts || {}),
              phone: e.telefono || e.phone,
              photo: e.foto || e.photo,
              roleId: e.rol_id || e.roleId
            }));
            setEmployees(mapped);
          }
        }

        if (turnoRes.status === 'fulfilled') {
          const rawShifts = turnoRes.value;
          const loadedShifts = Array.isArray(rawShifts)
            ? rawShifts
            : rawShifts?.data?.data || rawShifts?.data || [];
          if (Array.isArray(loadedShifts)) {
            const mappedShifts = loadedShifts.map((s) => ({
              id: s.id,
              employeeId: s.empleado_id || s.employeeId,
              date: s.fecha || s.date,
              status: backendToUiShiftStatus(s.estado || s.status, s.turno_habitual)
            }));
            setShifts(mappedShifts);
          }
        }
      } catch {
        // En caso de corte o inicio fresco, se conservan los datos locales
      }
    };

    loadBackendData();
  }, []);

  const activeEmployees = employees.filter(
    (emp) =>
      emp.id !== 'emp-admin' &&
      emp.id !== 'emp-customer' &&
      emp.email !== 'admin@nextbyte.com' &&
      emp.legajo !== 'ADM-001'
  );

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setCurrentView('form');
  };

  const handleSaveEmployee = async (emp) => {
    const nombreLimpio = (emp.firstName || emp.nombre || '').trim();
    const apellidoLimpio = (emp.lastName || emp.apellido || '').trim() || nombreLimpio;
    const legajoLimpio = String(emp.legajo || Math.floor(1000 + Math.random() * 9000)).trim();
    const emailLimpio = (emp.email || '').trim().toLowerCase();
    const passLimpio = emp.password && emp.password.length >= 6 ? emp.password : '123456';

    // 1. Doble verificación de unicidad de email antes de enviar
    const emailDuplicado = employees.find(
      (e) =>
        (e.email || '').toLowerCase().trim() === emailLimpio &&
        (!editingEmployee || (e.id !== emp.id && e.id !== editingEmployee.id))
    );

    if (emailDuplicado) {
      toast.error('Ya existe un empleado registrado con ese email.');
      return;
    }

    const payloadBackend = {
      nombre: nombreLimpio,
      apellido: apellidoLimpio,
      legajo: legajoLimpio,
      email: emailLimpio,
      telefono: emp.phone || emp.telefono || null,
      foto: emp.photo || emp.foto || null,
      fecha_nacimiento: emp.birthDate || emp.fecha_nacimiento || null,
      fecha_ingreso: emp.joinDate || emp.fecha_ingreso || null,
      turno_habitual: emp.usualShift || emp.turno_habitual || 'Turno Mañana',
      dias_franco: Array.isArray(emp.workDays) ? emp.workDays : [],
      rol_id: emp.roleId || emp.rol_id || null,
      contrasena: passLimpio
    };

    try {
      if (editingEmployee) {
        // En edición no enviar contraseña si no se alteró
        if (!emp.password || emp.password.length < 6) {
          delete payloadBackend.contrasena;
        }

        const res = await empleadoService.actualizar(emp.id, payloadBackend);
        const updated =
          res && typeof res === 'object' && res.nombre
            ? res
            : res?.data?.data || res?.data || payloadBackend;

        setEmployees((prev) =>
          prev.map((item) =>
            item.id === emp.id
              ? {
                  ...item,
                  ...emp,
                  id: updated.id || emp.id,
                  firstName: updated.nombre || nombreLimpio,
                  lastName: updated.apellido || apellidoLimpio,
                  displayName: (emp.displayName || `${nombreLimpio} ${apellidoLimpio}`).trim(),
                  email: updated.email || emailLimpio
                }
              : item
          )
        );
        toast.success('Empleado actualizado con éxito');
        setEditingEmployee(null);
        setCurrentView('list');
      } else {
        const res = await empleadoService.crear(payloadBackend);
        const created =
          res && typeof res === 'object' && res.nombre
            ? res
            : res?.data?.data || res?.data || payloadBackend;

        const newEmpObj = {
          ...emp,
          id: created.id || emp.id || `emp-${Date.now()}`,
          firstName: created.nombre || nombreLimpio,
          lastName: created.apellido || apellidoLimpio,
          displayName: (emp.displayName || `${nombreLimpio} ${apellidoLimpio}`).trim(),
          legajo: created.legajo || legajoLimpio,
          email: created.email || emailLimpio,
          roleId: created.rol_id || emp.roleId
        };

        setEmployees((prev) => [...prev, newEmpObj]);
        toast.success('Empleado guardado con éxito');
        setEditingEmployee(null);
        setCurrentView('list');
      }
    } catch (err) {
      console.error('Error al guardar en backend:', err);
      const msg = err.response?.data?.message || err.message || 'Error al guardar el empleado';
      toast.error(msg);
      // NUNCA guardar en fallback local si falla el backend o hay duplicados.
      // Se mantiene la vista del formulario abierta para que el usuario pueda corregir el email.
    }
  };

  const handleDeleteEmployee = async (id) => {
    try {
      await empleadoService.eliminar(id);
      setEmployees((prev) => prev.filter((item) => item.id !== id));
      toast.success('Empleado eliminado con éxito');
    } catch (err) {
      console.error('Error al eliminar en backend:', err);
      const msg = err.response?.data?.message || err.message || 'Error al eliminar el empleado';
      toast.error(msg);
    }
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setCurrentView('grid');
  };

  const handleUpdateShift = async (newShift) => {
    // 1. Actualización optimista de estado
    setShifts((prev) => {
      const idx = prev.findIndex(
        (s) =>
          (s.employeeId === newShift.employeeId || s.empleado_id === newShift.employeeId) &&
          (s.date === newShift.date || s.fecha === newShift.date)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newShift;
        return copy;
      }
      return [...prev, newShift];
    });

    // 2. Persistencia en la tabla turnos_empleados de SQLite
    try {
      const backendEstado = shiftToBackendStatus(newShift.status || newShift.estado);
      const empId = newShift.employeeId || newShift.empleado_id;
      const fecha = newShift.date || newShift.fecha;

      await turnoService.guardar({
        empleado_id: empId,
        fecha: fecha,
        estado: backendEstado
      });
    } catch (err) {
      console.warn('Turno guardado localmente (fallback):', err.message);
    }
  };

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F3E5DC] w-full min-w-0 max-w-full">
      {/* Header and Controls */}
      <div className="flex items-center p-4 bg-[#EAD5C8] border-b border-[#D7BBA6] relative w-full h-[72px] z-10 shrink-0">
        <div className="flex items-center gap-4 text-2xl font-bold text-[#4B2B1D] absolute left-1/2 -translate-x-1/2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 hover:bg-[#D7BBA6] rounded-md transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span
            className="min-w-[200px] text-center cursor-pointer hover:text-[#70422B] transition-colors select-none"
            onClick={() => {
              setCurrentDate(new Date());
              setCurrentView('grid');
              setEditingEmployee(null);
            }}
            title="Volver a la fecha actual y grilla"
          >
            {monthNames[currentDate.getMonth()].toUpperCase()} {currentDate.getFullYear()}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 hover:bg-[#D7BBA6] rounded-md transition-colors cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-4 ml-auto relative z-20">
          <DropdownMenu>
            <DropdownMenuTrigger className="px-4 py-2 bg-[#9F4F2F] text-white rounded-md text-sm font-semibold hover:bg-[#8A4326] flex items-center gap-2 cursor-pointer shadow-xs transition-colors">
              <Settings className="w-4 h-4" />
              <span>Gestionar Empleados</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white rounded-xl shadow-lg border border-gray-200 p-1">
              <DropdownMenuItem
                onClick={() => {
                  setEditingEmployee(null);
                  setCurrentView('form');
                }}
                className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3E5DC] flex items-center gap-2 cursor-pointer rounded-lg font-medium"
              >
                <Plus className="w-4 h-4 text-gray-600" />
                <span>Agregar empleado nuevo</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCurrentView('list')}
                className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F3E5DC] flex items-center gap-2 cursor-pointer rounded-lg font-medium"
              >
                <Search className="w-4 h-4 text-gray-600" />
                <span>Listar empleados</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCurrentView('grid')}
                className="w-full px-4 py-2.5 text-sm font-bold text-[#9F4F2F] hover:bg-[#F3E5DC] flex items-center gap-2 cursor-pointer rounded-lg"
              >
                <ArrowLeft className="w-4 h-4 text-[#9F4F2F]" />
                <span>Volver a Grilla</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row gap-4 min-w-0 max-w-full">
        {currentView === 'grid' && (
          <>
            {/* Left Sidebar Mini Calendar */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
              <div className="lg:sticky lg:top-0">
                <MiniCalendar
                  currentDate={currentDate}
                  onDateSelect={(date) => {
                    setCurrentDate(date);
                    setCurrentView('grid');
                  }}
                />
              </div>
            </div>

            {/* Main Area: Rotation Grid & Metrics */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">
              {/* Grilla de Rotación: SIEMPRE visible con 7 días, nunca se achica */}
              <div className="w-full rounded-xl shadow-xs border border-[#EAD5C8] bg-white overflow-hidden shrink-0">
                <RotationGrid
                  employees={activeEmployees}
                  shifts={shifts}
                  currentDate={currentDate}
                  onUpdateShift={handleUpdateShift}
                  onEditEmployee={handleEditEmployee}
                />
              </div>

              {/* Panel de Métricas: DEBAJO de la grilla, sin taparla jamás */}
              <div className="w-full bg-white rounded-xl shadow-xs border border-[#EAD5C8] overflow-hidden shrink-0">
                <div
                  className="p-4 border-b border-[#EAD5C8] bg-[#F9F4F0] flex justify-between items-center cursor-pointer hover:bg-[#F3E5DC] transition-colors select-none"
                  onClick={() => setShowMetrics(!showMetrics)}
                  title={showMetrics ? 'Ocultar panel de métricas' : 'Mostrar panel de métricas'}
                >
                  <h2 className="font-bold text-[#4B2B1D] uppercase text-sm tracking-wide">
                    Panel de Métricas y Análisis
                  </h2>
                  <div className="p-1 rounded-full hover:bg-[#EAD5C8] transition-colors">
                    {showMetrics ? (
                      <ChevronUp className="w-5 h-5 text-[#70422B]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#70422B]" />
                    )}
                  </div>
                </div>

                {showMetrics && (
                  <MetricsPanel shifts={shifts} currentDate={currentDate} employees={employees} />
                )}
              </div>
            </div>
          </>
        )}

        {currentView === 'list' && (
          <EmployeeList
            employees={activeEmployees}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteEmployee}
          />
        )}

        {currentView === 'form' && (
          <EmployeeForm
            roles={roles}
            initialData={editingEmployee}
            existingEmployees={employees}
            onSave={handleSaveEmployee}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
    </div>
  );
}

export default EmployeesPage;
