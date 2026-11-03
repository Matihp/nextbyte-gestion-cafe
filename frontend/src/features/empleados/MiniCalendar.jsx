import React from 'react';

export function MiniCalendar({ currentDate = new Date(), onDateSelect }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedDay = currentDate.getDate();

  const daysOfWeek = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDayClick = (day) => {
    const newDate = new Date(year, month, day);
    if (onDateSelect) {
      onDateSelect(newDate);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-[#EAD5C8] h-fit flex flex-col items-center">
      <div className="text-center font-bold text-[#4B2B1D] text-sm mb-3">
        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
      </div>

      <div className="grid grid-cols-7 gap-1 w-full text-center text-xs mb-2 text-gray-500 font-medium">
        {daysOfWeek.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 w-full">
        {blanks.map((b) => (
          <div key={`blank-${b}`} className="w-8 h-8" />
        ))}
        {days.map((day) => {
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                isSelected
                  ? 'bg-[#9F4F2F] text-white shadow-sm'
                  : 'hover:bg-[#F9F4F0] text-gray-700'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-5 text-xs text-gray-600 flex flex-col gap-2 w-full pt-3 border-t border-[#EAD5C8]">
        <p className="font-semibold text-center mb-1 text-[#4B2B1D]">Leyenda de visualización:</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span>
          <span>Operativo</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span>
          <span>Franco</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>
          <span>Vacaciones</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-400 inline-block"></span>
          <span>Licencia</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-800 inline-block"></span>
          <span>Ausente</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-white border-2 border-gray-300 inline-block"></span>
          <span>S/T (Sin Turno)</span>
        </div>
      </div>
    </div>
  );
}

export default MiniCalendar;

