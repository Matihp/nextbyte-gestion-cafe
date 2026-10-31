import React, { useState, useEffect} from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Colores corporativos
const COLORES = ['#4B2B1D', '#D7BBA6', '#F3E5DC', '#A0522D', '#8B4513'];

const obtenerSemana = (offset = 0) => {
  const hoy = new Date();
  const diaSemana = hoy.getDay();

  // Obtener el lunes de la semana actual.
  const diferenciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diferenciaLunes + (offset * 7));

  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return Array.from({ length: 7 }, (_, index) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + index);

    const fechaString = [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, '0'),
      String(fecha.getDate()).padStart(2, '0')
    ].join('-');

    return {
      fecha: fechaString,
      dia: `${dias[fecha.getDay()]} ${fecha.getDate()}`,
      totalDia: 0,
      cantidadPedidos: 0
    };
  });
};

const obtenerPedidosDeSemana = (ventasPorDia, offset) => {
  const semana = obtenerSemana(offset);

  const ventasPorFecha = new Map(
    ventasPorDia.map(item => [item.dia, item])
  );

  return semana.map(dia => {
    const venta = ventasPorFecha.get(dia.fecha);

    return {
      ...dia,
      totalDia: venta ? Number(venta.totalDia) || 0 : 0,
      cantidadPedidos: venta ? Number(venta.cantidadPedidos) || 0 : 0
    };
  });
};

const renderEtiquetaCategoria = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    name
}) => {
    const RADIAN = Math.PI / 180;
    const radio = outerRadius + 25;

    const x = cx + radio * Math.cos(-midAngle * RADIAN);
    const y = cy + radio * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="#4B2B1D"
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={12}
            fontWeight={600}
        >
            {name}
        </text>
    );
};

const renderEtiquetaMotivo = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  motivo,
  cantidad
}) => {
  const RADIAN = Math.PI / 180;
  const radio = outerRadius + 25;

  const x = cx + radio * Math.cos(-midAngle * RADIAN);
  const y = cy + radio * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#4B2B1D"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${motivo}: ${cantidad}`}
    </text>
  );
};

export default function Estadisticas() {
    const [datos, setDatos] = useState({
        franjaHoraria: [],
        pedidosDiarios: [],
        ventasCategoria: [],
        mermas: []
    });
    const [cargando, setCargando] = useState(true);
    const [semanaOffset, setSemanaOffset] = useState(0);

    // useEffect para buscar los datos cuando carga la pantalla
    useEffect(() => {
        const fetchDatos = async () => {
            try {
                const response = await fetch('/api/reportes/estadisticas');
                const result = await response.json();

                if (result.success) {
                    
                    // Generamos todas las franjas horarias desde las 08:00 hasta las 22:00.
                    const franjasBase = Array.from({ length: 15 }, (_, index) => {
                        const hora = `${String(index + 8).padStart(2, '0')}:00`;

                        return {
                            hora,
                            Mostrador: 0,
                            TakeAway: 0,
                            Delivery: 0
                        };
                    });

                    // Creamos un Map para localizar cada franja rápidamente.
                    const franjasMap = new Map(
                        franjasBase.map(franja => [franja.hora, franja])
                    );

                    // Incorporamos las ventas reales recibidas desde el backend.
                    result.data.ventasPorFranjaHoraria.forEach(curr => {
                        const franja = franjasMap.get(curr.hora);

                        if (
                            franja &&
                            Object.prototype.hasOwnProperty.call(
                                franja,
                                curr.tipo_pedido
                            )
                        ) {
                            franja[curr.tipo_pedido] += Number(curr.cantidadPedidos) || 0;
                        }
                    });

                    setDatos({
                        franjaHoraria: franjasBase,
                        pedidosDiarios: result.data.ventasPorDia,
                        ventasCategoria: result.data.ventasPorCategoria,
                        mermas: result.data.historialMermas
                    });
                }
            } catch (error) {
                console.error("Error al traer estadísticas:", error);
            } finally {
                setCargando(false);
            }
        };

        fetchDatos();
    }, []);

    // Datos correspondientes a la semana seleccionada
    const pedidosSemana = obtenerPedidosDeSemana(
        datos.pedidosDiarios,
        semanaOffset
    );

    // Fechas de inicio y fin de la semana
    const inicioSemana = obtenerSemana(semanaOffset)[0].fecha;
    const finSemana = obtenerSemana(semanaOffset)[6].fecha;

    // Formato de fecha para mostrar en pantalla
    const formatoFecha = (fecha) => {
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
    };

    // Pantalla de carga mientras llegan los datos
    if (cargando) {
        return <div className="p-6 text-primary font-semibold">Cargando estadísticas...</div>;
    }

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Picos de Ventas por Franja Horaria */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4 text-primary">Picos de Ventas por Franja Horaria</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={datos.franjaHoraria}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                            <XAxis dataKey="hora" ticks={[
                                '08:00',
                                '10:00',
                                '12:00',
                                '14:00',
                                '16:00',
                                '18:00',
                                '20:00',
                                '22:00'
                                ]} 
                            />
                            <YAxis allowDecimals={false} tickCount={4}/>
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Mostrador" stroke="#0088FE" strokeWidth={2} connectNulls />
                            <Line type="monotone" dataKey="TakeAway" stroke="#FF7F0E" strokeWidth={2} connectNulls />
                            <Line type="monotone" dataKey="Delivery" stroke="#2ECC71" strokeWidth={2} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Pedidos Diarios */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4 text-primary">Pedidos Diarios</h2>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <button type="button" onClick={() => setSemanaOffset(offset => offset - 1)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D7BBA6] text-[#4B2B1D] bg-white hover:bg-[#F3E5DC] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                            <span className="text-lg leading-none">←</span>
                             <span className="text-sm font-medium">Anterior</span>
                        </button>

                        <div className="text-center">
                            <p className="text-xs text-gray-500 font-medium">Semana seleccionada</p>
                            <p className="text-sm font-semibold text-[#4B2B1D]">{formatoFecha(inicioSemana)} - {formatoFecha(finSemana)}</p>
                        </div>

                        <button type="button" onClick={() => setSemanaOffset(offset => offset + 1)} disabled={semanaOffset >= 0} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D7BBA6] text-[#4B2B1D] bg-white hover:bg-[#F3E5DC] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                            <span className="text-sm font-medium">Siguiente</span>
                            <span className="text-lg leading-none">→</span>
                        </button>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={pedidosSemana}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="dia" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="totalDia" fill="#5C3A21" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* 3. Ventas por Categoría */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4 text-primary">Ventas por Categoría</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={datos.ventasCategoria} dataKey="cantidadVendida" nameKey="categoria" cx="50%" cy="50%" outerRadius={80} label={renderEtiquetaCategoria}
                            labelLine={{ stroke: '#A0522D', strokeWidth: 1 }}>
                                {datos.ventasCategoria.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORES[index % COLORES.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 4. Motivos de Eliminación */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4 text-primary">Motivos de Eliminación</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie data={datos.mermas} dataKey="cantidad" nameKey="motivo" cx="50%" cy="50%" outerRadius={80} label={renderEtiquetaMotivo} labelLine={{stroke: '#A0522D', strokeWidth: 1}}>
                                {datos.mermas.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#FF7F0E', '#FF3E3E', '#808080'][index % 3]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

            </div>
        </div>
    );
}