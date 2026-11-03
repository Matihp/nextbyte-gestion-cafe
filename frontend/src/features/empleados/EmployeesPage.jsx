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

export function EmployeesPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMetrics, setShowMetrics] = useState(true);
  const [currentView, setCurrentView] = useState('grid');
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [roles, setRoles] = useState(() => {
    const saved = localStorage.getItem('nextbyte_roles');
    return saved ? JSON.parse(saved) : INITIAL_ROLES;
  });

  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('nextbyte_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [shifts, setShifts] = useState(() => {
    const saved = localStorage.getItem('nextbyte_shifts');
    return saved ? JSON.parse(saved) : [];
  });

  // Guardar en localStorage ante cambios
  useEffect(() => {
    localStorage.setItem('nextbyte_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('nextbyte_shifts', JSON.stringify(shifts));
  }, [shifts]);

  // Carga e integración con el backend si está disponible
  useEffect(() => {
    const loadBackendData = async () => {
      try {
        const [empRes, rolRes, turnoRes] = await Promise.allSettled([
          empleadoService.obtenerTodos(),
          rolService.obtenerTodos(),
          turnoService.obtenerTodos()
        ]);

        if (rolRes.status === 'fulfilled' && rolRes.value?.data?.data) {
          const loadedRoles = rolRes.value.data.data;
          if (Array.isArray(loadedRoles) && loadedRoles.length > 0) {
            setRoles(loadedRoles);
          }
        }

        if (empRes.status === 'fulfilled' && empRes.value?.data?.data) {
          const loadedEmps = empRes.value.data.data;
          if (Array.isArray(loadedEmps) && loadedEmps.length > 0) {
            const mapped = loadedEmps.map((e) => ({
              ...e,
              firstName: e.nombre || e.firstName,
              lastName: e.apellido || e.lastName,
              displayName: e.displayName || `${e.nombre || ''} ${e.apellido || ''}`.trim(),
              usualShift: e.turno_habitual || e.usualShift || 'Turno Mañana',
              workDayShifts: e.workDayShifts || e.dias_franco || {},
              phone: e.telefono || e.phone,
              photo: e.foto || e.photo,
              roleId: e.rol_id || e.roleId
            }));
            setEmployees(mapped);
          }
        }

        if (turnoRes.status === 'fulfilled' && turnoRes.value?.data?.data) {
          const loadedShifts = turnoRes.value.data.data;
          if (Array.isArray(loadedShifts) && loadedShifts.length > 0) {
            const mappedShifts = loadedShifts.map((s) => ({
              id: s.id,
              employeeId: s.empleado_id || s.employeeId,
              date: s.fecha || s.date,
              status: s.estado || s.status
            }));
            setShifts(mappedShifts);
          }
        }
      } catch {
        // En caso de que el backend esté en desarrollo, se conservan los datos locales
      }
    };

    loadBackendData();
  }, []);

  const activeEmployees = employees.filter(
    (emp) => emp.id !== 'emp-admin' && emp.id !== 'emp-customer'
  );

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setCurrentView('form');
  };

  const handleSaveEmployee = async (emp) => {
    try {
      if (editingEmployee) {
        setEmployees((prev) => prev.map((item) => (item.id === emp.id ? { ...item, ...emp } : item)));
        toast.success(`Empleado ${emp.firstName} ${emp.lastName || ''} actualizado con éxito`);
        try {
          await empleadoService.actualizar(emp.id, emp);
        } catch {
          // Guardado localmente con éxito
        }
      } else {
        setEmployees((prev) => [...prev, emp]);
        toast.success(`Empleado ${emp.firstName} agregado con éxito`);
        try {
          await empleadoService.crear(emp);
        } catch {
          // Guardado localmente con éxito
        }
      }
    } finally {
      setEditingEmployee(null);
      setCurrentView('list');
    }
  };

  const handleDeleteEmployee = async (id) => {
    setEmployees((prev) => prev.filter((item) => item.id !== id));
    toast.success('Empleado eliminado correctamente');
    try {
      await empleadoService.eliminar(id);
    } catch {
      // Eliminado localmente
    }
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    setCurrentView('grid');
  };

  const handleUpdateShift = async (newShift) => {
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

    try {
      await turnoService.guardar({
        empleado_id: newShift.employeeId || newShift.empleado_id,
        fecha: newShift.date || newShift.fecha,
        estado: newShift.status || newShift.estado
      });
    } catch {
      // Actualizado localmente
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
    <div className="flex flex-col h-full bg-[#F3E5DC]">
      {/* Header and Controls */}
      <div className="flex items-center p-4 bg-[#EAD5C8] border-b border-[#D7BBA6] relative w-full h-[72px] z-30 shrink-0">
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

        <div className="flex items-center gap-4 ml-auto relative z-40">
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

      <div className="flex-1 overflow-auto p-4 flex gap-4">
        {currentView === 'grid' && (
          <>
            {/* Left Sidebar Mini Calendar */}
            <div className="w-64 shrink-0 flex flex-col gap-4">
              <MiniCalendar
                currentDate={currentDate}
                onDateSelect={(date) => {
                  setCurrentDate(date);
                  setCurrentView('grid');
                }}
              />
            </div>

            {/* Main Area: Rotation Grid & Metrics */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex-1 overflow-hidden rounded-xl shadow-xs border border-[#EAD5C8]">
                <RotationGrid
                  employees={activeEmployees}
                  shifts={shifts}
                  currentDate={currentDate}
                  onUpdateShift={handleUpdateShift}
                  onEditEmployee={handleEditEmployee}
                />
              </div>

              {/* Metrics Panel */}
              <div className="bg-white rounded-xl shadow-xs border border-[#EAD5C8] overflow-hidden mt-auto">
                <div
                  className="p-4 border-b border-[#EAD5C8] bg-[#F9F4F0] flex justify-between items-center cursor-pointer hover:bg-[#F3E5DC] transition-colors"
                  onClick={() => setShowMetrics(!showMetrics)}
                >
                  <h2 className="font-semibold text-[#4B2B1D] uppercase text-sm">
                    Panel de Métricas y Análisis
                  </h2>
                  {showMetrics ? (
                    <ChevronDown className="w-5 h-5 text-[#70422B]" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-[#70422B]" />
                  )}
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
            onSave={handleSaveEmployee}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
    </div>
  );
}

export default EmployeesPage;

