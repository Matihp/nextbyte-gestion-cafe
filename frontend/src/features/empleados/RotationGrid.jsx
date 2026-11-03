import React, { useState, useRef, useEffect } from 'react';
import { Printer, Download } from 'lucide-react';
import { PrintPortal } from './PrintPortal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export const formatGridEmployeeName = (emp) => {
  if (!emp) return 'Empleado';
  const rawDisplayName = (emp.displayName || '').trim();
  const nombre = (emp.firstName || emp.nombre || '').trim();
  const apellido = (emp.lastName || emp.apellido || '').trim();

  // Si tiene un nombre distintivo específico:
  if (rawDisplayName) {
    if (rawDisplayName.includes(' ')) {
      return rawDisplayName
        .split(/\s+/)
        .map((part) => (part.length > 6 ? `${part.slice(0, 6)}...` : part))
        .join('\n');
    }
    if (rawDisplayName.length > 6) {
      return `${rawDisplayName.slice(0, 6)}...`;
    }
    return rawDisplayName;
  }

  // Si no tiene nombre distintivo, formatear nombre y apellido:
  const n = nombre.length > 6 ? `${nombre.slice(0, 6)}...` : nombre;
  const a = apellido.length > 6 ? `${apellido.slice(0, 6)}...` : apellido;
  return [n, a].filter(Boolean).join('\n') || 'Empleado';
};

export function RotationGrid({
  employees = [],
  shifts = [],
  currentDate = new Date(),
  onUpdateShift,
  onEditEmployee
}) {
  const [activeCell, setActiveCell] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const scrollContainerRef = useRef(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dayNameShort = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const dayName = dayNameShort.charAt(0).toUpperCase() + dayNameShort.slice(1, 3);
    return {
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      dayNum: i + 1,
      dayName
    };
  });

  const getShiftStatus = (employeeId, dateStr) => {
    const shift = shifts.find(
      (s) =>
        (s.employeeId === employeeId || s.empleado_id === employeeId) &&
        (s.date === dateStr || s.fecha === dateStr)
    );
    if (shift) return shift.status || shift.estado;

    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return 'Turno Mañana';

    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const fullDayMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const fullDayName = fullDayMap[dateObj.getDay()];

    const workDayShifts = emp.workDayShifts || emp.work_day_shifts || emp.dias_franco_turnos || {};
    if (workDayShifts && typeof workDayShifts === 'object' && Object.keys(workDayShifts).length > 0) {
      if (workDayShifts[fullDayName]) {
        return workDayShifts[fullDayName];
      }
      return 'S/T';
    }

    const workDays = emp.workDays || emp.work_days || [];
    if (Array.isArray(workDays) && workDays.length > 0 && !workDays.includes(fullDayName)) {
      return 'S/T';
    }

    return emp.usualShift || emp.turno_habitual || 'Turno Mañana';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Turno Mañana':
      case 'Turno Tarde':
      case 'Turno Encargado':
      case 'Turno C.E':
      case 'Turno Único':
      case 'OPERATIVO':
      case 'presente':
        return 'bg-green-600 text-white';
      case 'FRANCO':
      case 'franco':
        return 'bg-red-600 text-white';
      case 'VACACIONES':
      case 'vacaciones':
        return 'bg-yellow-400 text-gray-900';
      case 'LICENCIA':
      case 'licencia':
        return 'bg-blue-400 text-white';
      case 'AUSENTE':
      case 'ausente':
        return 'bg-gray-800 text-white';
      case 'S/T':
        return 'bg-white text-black border-2 border-gray-300';
      default:
        return 'bg-gray-200 text-gray-900';
    }
  };

  const getPrintStatusColor = (status) => {
    switch (status) {
      case 'Turno Mañana':
      case 'Turno Tarde':
      case 'Turno Encargado':
      case 'Turno C.E':
      case 'Turno Único':
      case 'OPERATIVO':
        return 'bg-green-400 text-white';
      case 'FRANCO':
        return 'bg-red-400 text-white';
      case 'VACACIONES':
        return 'bg-yellow-200 text-gray-900';
      case 'LICENCIA':
        return 'bg-blue-400 text-white';
      case 'AUSENTE':
        return 'bg-gray-500 text-white';
      case 'S/T':
        return 'bg-white text-black border-2 border-gray-300';
      default:
        return 'bg-gray-200 text-gray-900';
    }
  };

  const getHexColor = (status) => {
    switch (status) {
      case 'Turno Mañana':
      case 'Turno Tarde':
      case 'Turno Encargado':
      case 'Turno C.E':
      case 'Turno Único':
      case 'OPERATIVO':
        return '#4ade80';
      case 'FRANCO':
        return '#f87171';
      case 'VACACIONES':
        return '#fef08a';
      case 'LICENCIA':
        return '#60a5fa';
      case 'AUSENTE':
        return '#6b7280';
      case 'S/T':
        return '#ffffff';
      default:
        return '#e5e7eb';
    }
  };

  const getTextColor = (status) => {
    switch (status) {
      case 'VACACIONES':
      case 'S/T':
        return '#111827';
      default:
        return '#ffffff';
    }
  };

  const handleExportExcel = () => {
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #999; padding: 8px; text-align: center; }
          th { background-color: #D7BBA6; color: #4B2B1D; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Grilla de Personal - ${currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
        <table>
          <thead>
            <tr>
              <th>Día</th>
              ${employees.map((emp) => `<th>${emp.displayName || `${emp.firstName || emp.nombre} ${emp.lastName || emp.apellido || ''}`}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    days.forEach((day) => {
      tableHtml += `<tr><td>${day.dayNum} - ${day.dayName}</td>`;
      employees.forEach((emp) => {
        const status = getShiftStatus(emp.id, day.dateStr);
        const bgColor = getHexColor(status);
        const color = getTextColor(status);
        tableHtml += `<td style="background-color: ${bgColor}; color: ${color}; font-weight: bold;">${status}</td>`;
      });
      tableHtml += `</tr>`;
    });

    tableHtml += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Grilla_Personal_${currentDate.toLocaleDateString('es-ES', { month: '2-digit', year: 'numeric' })}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = (employeeId, dateStr, newStatus) => {
    const existingShift = shifts.find(
      (s) =>
        (s.employeeId === employeeId || s.empleado_id === employeeId) &&
        (s.date === dateStr || s.fecha === dateStr)
    );

    if (onUpdateShift) {
      onUpdateShift({
        id: existingShift?.id || `shift-${employeeId}-${dateStr}`,
        employeeId,
        empleado_id: employeeId,
        date: dateStr,
        fecha: dateStr,
        status: newStatus,
        estado: newStatus
      });
    }

    setActiveCell(null);
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetDay = currentDate.getDate();
      const rowElement = scrollContainerRef.current.querySelector(`[data-day="${targetDay}"]`);
      if (rowElement) {
        scrollContainerRef.current.scrollTo({
          top: Math.max(0, rowElement.offsetTop - 130),
          behavior: 'smooth'
        });
      }
    }
  }, [currentDate]);

  const tableWidth = employees.length > 6 ? `calc(6rem + (100% - 6rem) * ${employees.length} / 6)` : '100%';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#EAD5C8] overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-[#EAD5C8] bg-[#F9F4F0] flex justify-between items-center">
        <h2 className="font-semibold text-[#4B2B1D]">
          Grilla de Rotación de Staff - {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#217346] text-white rounded-lg text-sm font-bold hover:bg-[#1e6b41] transition-colors shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPrinting(true);
              setTimeout(() => {
                window.print();
                setIsPrinting(false);
              }, 100);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#4B2B1D] text-white rounded-lg text-sm font-bold hover:bg-[#3a2216] transition-colors shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Grilla
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#F3E5DC] flex items-center justify-center text-[#70422B]">
            <Printer className="w-6 h-6 opacity-40" />
          </div>
          <h3 className="font-semibold text-[#4B2B1D] text-base">No hay empleados registrados</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Hacé clic en el botón superior <strong>"Gestionar Empleados" &gt; "Nuevo Empleado"</strong> para dar de alta al primer empleado y asignarle sus turnos.
          </p>
        </div>
      ) : (
      <div
        ref={scrollContainerRef}
        className="overflow-auto"
        style={{ maxHeight: '480px' }}
        onScroll={() => {
          if (activeCell) setActiveCell(null);
        }}
      >
        <table className="border-collapse table-fixed w-full" style={{ minWidth: '100%', width: tableWidth }}>
          <thead className="bg-[#D7BBA6] sticky top-0 z-20 shadow-xs">
            <tr className="bg-[#D7BBA6]">
              <th className="w-24 border-r border-[#C29E87] bg-[#D7BBA6] sticky left-0 z-30 p-2" />
              {employees.map((emp) => {
                const nombre = emp.firstName || emp.nombre || '';
                const apellido = emp.lastName || emp.apellido || '';
                const fullName = emp.displayName || `${nombre} ${apellido}`.trim() || 'Empleado';
                return (
                  <th
                    key={emp.id}
                    className="min-w-[120px] p-3 text-center border-r border-[#C29E87] bg-[#D7BBA6] cursor-pointer hover:bg-[#C29E87] transition-colors select-none"
                    onClick={() => onEditEmployee && onEditEmployee(emp)}
                    title={`Empleado: ${fullName} (Click para editar)`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Avatar className="w-12 h-12 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={emp.photo || emp.foto} alt={nombre} className="object-cover" />
                        <AvatarFallback className="bg-white text-[#70422B] font-bold text-sm">
                          {nombre.charAt(0)}
                          {apellido.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm font-semibold text-[#4B2B1D] leading-tight whitespace-pre-line break-words max-w-[110px] text-center">
                        {formatGridEmployeeName(emp)}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.dateStr} data-day={day.dayNum} className="hover:bg-gray-50 h-12">
                <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-200 p-2 text-center text-sm font-medium text-gray-700 shadow-[1px_0_0_0_#e5e7eb] w-24">
                  {day.dayNum} - {day.dayName}
                </td>
                {employees.map((emp) => {
                  const status = getShiftStatus(emp.id, day.dateStr);
                  return (
                    <td
                      key={`${emp.id}-${day.dateStr}`}
                      className="border-r border-b border-white p-0 relative min-w-[120px]"
                    >
                      <div
                        onClick={(e) =>
                          setActiveCell({
                            employeeId: emp.id,
                            dateStr: day.dateStr,
                            rect: e.currentTarget.getBoundingClientRect()
                          })
                        }
                        className={`w-full h-10 flex items-center justify-center text-xs font-bold cursor-pointer transition-opacity hover:opacity-80 ${getStatusColor(
                          status
                        )}`}
                      >
                        {status}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {activeCell && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActiveCell(null)} />
          {activeCell.rect && (
            <div
              className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden w-[140px]"
              style={{
                top:
                  activeCell.rect.bottom + window.scrollY > window.innerHeight - 180
                    ? activeCell.rect.top - 180
                    : activeCell.rect.bottom + 4,
                left: activeCell.rect.left + activeCell.rect.width / 2,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'Turno Mañana')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 rounded cursor-pointer"
                >
                  Turno Mañana
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'Turno Tarde')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 rounded cursor-pointer"
                >
                  Turno Tarde
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'Turno Encargado')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 rounded cursor-pointer"
                >
                  Turno Encargado
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'Turno C.E')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 rounded cursor-pointer"
                >
                  Turno C.E
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'Turno Único')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 rounded cursor-pointer"
                >
                  Turno Único
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'FRANCO')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 rounded cursor-pointer"
                >
                  FRANCO
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'VACACIONES')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-yellow-700 hover:bg-yellow-50 rounded cursor-pointer"
                >
                  VACACIONES
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'LICENCIA')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                >
                  LICENCIA
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'AUSENTE')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-gray-800 hover:bg-gray-200 rounded cursor-pointer"
                >
                  AUSENTE
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeCell.employeeId, activeCell.dateStr, 'S/T')}
                  className="w-full text-left px-3 py-1.5 text-xs font-bold text-black hover:bg-gray-100 rounded cursor-pointer"
                >
                  S/T (Sin Turno)
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isPrinting && (
        <style>
          {`
            @media print {
              body > #root {
                display: none !important;
              }
              body > #print-area {
                display: block !important;
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #print-area table {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              @page {
                size: auto;
                margin: 10mm 15mm;
              }
            }
          `}
        </style>
      )}
      <PrintPortal id="print-area">
        <div
          className="w-full flex flex-col bg-white text-black print-exact-colors text-left"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="text-left mb-3 shrink-0">
            <h1 className="text-xl font-bold uppercase tracking-wide text-[#4B2B1D] inline-block">
              Grilla de Personal
            </h1>
            <span className="text-lg font-medium text-gray-500 mx-2">-</span>
            <span className="text-sm font-semibold text-gray-600">
              Desde: {currentDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} (Próximos 7 días)
            </span>
          </div>

          <table
            className="border-collapse border-2 border-gray-400 table-auto text-left"
            style={{ minWidth: '380px', maxWidth: '100%', pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            <thead className="bg-[#D7BBA6]">
              <tr>
                <th className="w-24 border-2 border-gray-400 p-2 text-center bg-[#D7BBA6] text-base font-bold text-[#4B2B1D]">
                  Día
                </th>
                {employees.map((emp) => {
                  const nombre = emp.firstName || emp.nombre || '';
                  const apellido = emp.lastName || emp.apellido || '';
                  return (
                    <th
                      key={emp.id}
                      className="p-2 border-2 border-gray-400 bg-[#D7BBA6] text-center font-bold text-[#4B2B1D] text-base uppercase whitespace-pre-line min-w-[120px]"
                    >
                      {formatGridEmployeeName(emp)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const startDay = currentDate.getDate();
                const yearNum = currentDate.getFullYear();
                const monthNum = currentDate.getMonth();

                return Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(yearNum, monthNum, startDay + i);
                  const dayNum = d.getDate();
                  const dayNameShort = d.toLocaleDateString('es-ES', { weekday: 'short' });
                  const dayName = dayNameShort.charAt(0).toUpperCase() + dayNameShort.slice(1, 3);
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

                  return (
                    <tr key={dateStr} className="h-auto">
                      <td className="border-2 border-gray-400 p-2 text-center text-base font-bold bg-gray-100">
                        {dayNum} {dayName}
                      </td>
                      {employees.map((emp) => {
                        const status = getShiftStatus(emp.id, dateStr);
                        return (
                          <td key={`${emp.id}-${dateStr}`} className="border-2 border-gray-400 p-1 text-center">
                            <div
                              className={`w-full flex items-center justify-center text-sm font-bold min-h-[2.5rem] rounded px-2 ${getPrintStatusColor(
                                status
                              )}`}
                            >
                              {status}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </PrintPortal>
    </div>
  );
}

export default RotationGrid;

