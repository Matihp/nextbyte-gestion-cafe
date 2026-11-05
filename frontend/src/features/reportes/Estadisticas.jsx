import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Inbox, RotateCw, AlertCircle } from 'lucide-react';
import { useEstadisticas } from '@/hooks/useEstadisticas';

const PALETA_CATEGORIAS = [
  'var(--primary)',
  'var(--secondary)',
  'var(--accent)',
  '#D97706',
  '#8B4513',
  '#64748B'
];

function TarjetaGrafico({ titulo, children }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/30">
      <h2 className="text-base font-semibold text-primary mb-4 tracking-tight">
        {titulo}
      </h2>
      <div className="h-[270px] w-full">
        {children}
      </div>
    </div>
  );
}

function EstadoVacio({ mensaje = 'Sin datos registrados para este período' }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
      <Inbox className="w-8 h-8 opacity-40 text-secondary" />
      <p className="text-xs font-medium">{mensaje}</p>
    </div>
  );
}

export default function Estadisticas() {
  const {
    cargando,
    error,
    recargar,
    datosFranja,
    datosSemana,
    datosCategorias,
    datosMermas
  } = useEstadisticas();

  const tieneDatosFranja = datosFranja.some(
    (f) => f.Mostrador > 0 || f["Take Away"] > 0 || f.Delivery > 0
  );
  const tieneDatosSemana = datosSemana.some((d) => d.pedidos > 0);

  const renderEtiquetaTorta = ({ cx, cy, midAngle, outerRadius, etiqueta, name, value }) => {
    const RADIAN = Math.PI / 180;
    const radio = outerRadius + 22;
    const x = cx + radio * Math.cos(-midAngle * RADIAN);
    const y = cy + radio * Math.sin(-midAngle * RADIAN);
    const texto = etiqueta || `${name}: ${value}`;

    return (
      <text
        x={x}
        y={y}
        fill="var(--primary)"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {texto}
      </text>
    );
  };

  if (cargando) {
    return (
      <div className="py-20 text-primary font-medium flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Cargando estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-border/30 shadow-sm text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <div>
          <h3 className="font-semibold text-primary text-base">Error al cargar estadísticas</h3>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
        <button
          onClick={recargar}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* 1. Picos de Ventas por Franja Horaria */}
      <TarjetaGrafico titulo="Picos de Ventas por Franja Horaria">
        {!tieneDatosFranja ? (
          <EstadoVacio mensaje="No hay ventas por franja horaria registradas en este período" />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={datosFranja} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" />
              <XAxis
                dataKey="hora"
                ticks={['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tickCount={5}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="Mostrador"
                stroke="#0088FE"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0088FE' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Take Away"
                stroke="#FF7F0E"
                strokeWidth={2}
                dot={{ r: 3, fill: '#FF7F0E' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Delivery"
                stroke="#2ECC71"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2ECC71' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </TarjetaGrafico>

      {/* 2. Pedidos Diarios */}
      <TarjetaGrafico titulo="Pedidos Diarios">
        {!tieneDatosSemana ? (
          <EstadoVacio mensaje="No hay pedidos registrados en este período" />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={datosSemana} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" />
              <XAxis
                dataKey="dia"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip />
              <Legend
                verticalAlign="bottom"
                iconType="square"
                wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
              />
              <Bar
                dataKey="pedidos"
                name="Pedidos"
                fill="var(--primary)"
                radius={[3, 3, 0, 0]}
                barSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </TarjetaGrafico>

      {/* 3. Ventas por Categoría */}
      <TarjetaGrafico titulo="Ventas por Categoría">
        {datosCategorias.length === 0 ? (
          <EstadoVacio mensaje="No hay ventas por categoría registradas en este período" />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <PieChart margin={{ top: 15, right: 30, left: 30, bottom: 15 }}>
              <Pie
                data={datosCategorias}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={68}
                label={renderEtiquetaTorta}
                labelLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
              >
                {datosCategorias.map((entry, index) => (
                  <Cell
                    key={`cat-${index}`}
                    fill={PALETA_CATEGORIAS[index % PALETA_CATEGORIAS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </TarjetaGrafico>

      {/* 4. Motivos de Eliminación */}
      <TarjetaGrafico titulo="Motivos de Eliminación">
        {datosMermas.length === 0 ? (
          <EstadoVacio mensaje="No se registraron mermas en este período" />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <PieChart margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <Pie
                data={datosMermas}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={68}
                label={renderEtiquetaTorta}
                labelLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
              >
                {datosMermas.map((entry, index) => (
                  <Cell key={`merma-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                verticalAlign="bottom"
                iconType="square"
                wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </TarjetaGrafico>

    </div>
  );
}
