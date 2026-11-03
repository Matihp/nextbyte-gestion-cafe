import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as BarTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export function MetricsPanel({ shifts = [], currentDate = new Date(), employees = [] }) {
  const targetYear = currentDate.getFullYear();
  const targetMonthIndex = currentDate.getMonth();

  const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const maxWeeks = Math.ceil(daysInMonth / 7);
  const weekFilters = Array.from({ length: maxWeeks }, (_, i) => `Semana ${i + 1}`);

  const currentWeekNum = Math.min(Math.ceil(currentDate.getDate() / 7), maxWeeks);
  const [pieFilter, setPieFilter] = useState(`Semana ${currentWeekNum}`);

  const activeWeekFilter = weekFilters.includes(pieFilter) ? pieFilter : (weekFilters[0] || 'Semana 1');

  const getPieData = () => {
    const targetWeek = parseInt(activeWeekFilter.split(' ')[1], 10);

    const data = [
      { name: 'Operativo', value: 0 },
      { name: 'Franco', value: 0 },
      { name: 'Vacaciones', value: 0 },
      { name: 'Licencia', value: 0 },
      { name: 'Ausente', value: 0 }
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      const week = Math.min(Math.ceil(day / 7), maxWeeks);
      if (week === targetWeek) {
        const dateStr = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        employees.forEach((emp) => {
          const shift = shifts.find(
            (s) =>
              (s.employeeId === emp.id || s.empleado_id === emp.id) &&
              (s.date === dateStr || s.fecha === dateStr)
          );
          const status =
            shift?.status ||
            shift?.estado ||
            emp.usualShift ||
            emp.turno_habitual ||
            'Turno Mañana';

          if (
            [
              'Turno Mañana',
              'Turno Tarde',
              'Turno Encargado',
              'Turno C.E',
              'Turno Único',
              'OPERATIVO',
              'presente'
            ].includes(status)
          ) {
            data[0].value += 1;
          } else if (['FRANCO', 'franco'].includes(status)) {
            data[1].value += 1;
          } else if (['VACACIONES', 'vacaciones'].includes(status)) {
            data[2].value += 1;
          } else if (['LICENCIA', 'licencia'].includes(status)) {
            data[3].value += 1;
          } else if (['AUSENTE', 'ausente'].includes(status)) {
            data[4].value += 1;
          }
        });
      }
    }

    const hasData = data.some((d) => d.value > 0);
    return hasData ? data : data.map((d) => ({ ...d, value: 1, isEmpty: true }));
  };

  const availabilityData = getPieData();
  const STATUS_COLORS = ['#16a34a', '#dc2626', '#facc15', '#60a5fa', '#1f2937'];

  const absenteeismData = [];
  const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long' });

  for (let i = 4; i >= 0; i--) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const monthName = monthFormatter.format(d);

    const monthShifts = shifts.filter((s) => {
      const shiftDate = s.date || s.fecha || '';
      const [y, m] = shiftDate.split('-');
      return parseInt(y, 10) === d.getFullYear() && parseInt(m, 10) === d.getMonth() + 1;
    });

    const franco = monthShifts.filter((s) => (s.status || s.estado) === 'FRANCO').length;
    const vacaciones = monthShifts.filter((s) => (s.status || s.estado) === 'VACACIONES').length;
    const licencia = monthShifts.filter((s) => (s.status || s.estado) === 'LICENCIA').length;
    const ausente = monthShifts.filter((s) => (s.status || s.estado) === 'AUSENTE').length;

    absenteeismData.push({
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      Franco: franco,
      Vacaciones: vacaciones,
      Licencia: licencia,
      Ausente: ausente
    });
  }

  return (
    <div className="p-4 flex flex-col lg:flex-row gap-6 bg-white">
      {/* Gráfico Torta */}
      <div className="flex-1 border border-gray-200 rounded-lg p-4 flex flex-col">
        <h3 className="text-sm font-semibold text-[#4B2B1D] mb-4 text-center">
          Estado del Personal por Semana (Mes Actual)
        </h3>

        {/* Filtros de Semanas */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          {weekFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setPieFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                activeWeekFilter === filter
                  ? 'bg-[#4B2B1D] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="h-64 flex flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={availabilityData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
              >
                {availabilityData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isEmpty ? '#f3f4f6' : STATUS_COLORS[index % STATUS_COLORS.length]}
                  />
                ))}
              </Pie>
              <PieTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    if (payload[0].payload.isEmpty) return null;
                    return (
                      <div className="bg-white p-2 border border-gray-200 shadow-sm text-xs font-semibold text-gray-800 rounded">
                        {payload[0].name}: {payload[0].value}
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col justify-center text-xs text-gray-600 gap-2 min-w-[110px] pl-2">
            {availabilityData.map((d, idx) => (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: d.isEmpty ? '#d1d5db' : STATUS_COLORS[idx % STATUS_COLORS.length] }}
                />
                <span className="font-medium text-gray-700">{d.name}</span>
                <span className="text-gray-400 font-bold ml-auto">{d.isEmpty ? 0 : d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico Barras */}
      <div className="flex-1 border border-gray-200 rounded-lg p-4 flex flex-col">
        <h3 className="text-sm font-semibold text-[#4B2B1D] mb-4 text-center">
          Control de Ausentismo (Últimos 5 Meses)
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={absenteeismData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <BarTooltip
                contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="Franco" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Vacaciones" fill="#facc15" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Licencia" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ausente" fill="#1f2937" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default MetricsPanel;

