import { useState, useEffect, useCallback } from 'react';
import reporteService from '../services/reporteService';

const FRANJAS_HORARIAS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00'
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PALETA_MERMAS = [
  'var(--accent)',
  'var(--secondary)',
  'var(--primary)',
  '#D97706',
  '#EF4444',
  '#6B7280',
  '#8B5CF6'
];

export function useEstadisticas() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datosFranja, setDatosFranja] = useState([]);
  const [datosSemana, setDatosSemana] = useState([]);
  const [datosCategorias, setDatosCategorias] = useState([]);
  const [datosMermas, setDatosMermas] = useState([]);

  const procesarDatos = useCallback((data) => {
    const {
      ventasPorFranjaHoraria = [],
      ventasPorCategoria = [],
      historialMermas = [],
      ventasPorDia = []
    } = data || {};

    // 1. Franjas Horarias (08:00 a 22:00)
    const baseHoras = FRANJAS_HORARIAS.map((hora) => ({
      hora,
      Mostrador: 0,
      "Take Away": 0,
      Delivery: 0
    }));

    const mapaHoras = new Map(baseHoras.map((item) => [item.hora, item]));

    ventasPorFranjaHoraria.forEach((curr) => {
      const franja = mapaHoras.get(curr.hora);
      if (franja) {
        const tipoNormalizado =
          curr.tipo_pedido === 'salon' || curr.tipo_pedido === 'mesa'
            ? 'Mostrador'
            : curr.tipo_pedido === 'take_away' || curr.tipo_pedido === 'TakeAway'
            ? 'Take Away'
            : curr.tipo_pedido === 'delivery'
            ? 'Delivery'
            : curr.tipo_pedido;

        if (franja[tipoNormalizado] !== undefined) {
          franja[tipoNormalizado] += Number(curr.cantidadPedidos) || 0;
        }
      }
    });
    setDatosFranja(baseHoras);

    // 2. Pedidos Diarios (Lun a Dom)
    const baseDias = DIAS_SEMANA.map((dia) => ({ dia, pedidos: 0 }));
    const mapaDias = new Map();

    ventasPorDia.forEach((v) => {
      const fechaObj = new Date(v.fecha + 'T00:00:00');
      const diaSemanaIndex = (fechaObj.getDay() + 6) % 7;
      const nombreDia = DIAS_SEMANA[diaSemanaIndex];
      mapaDias.set(nombreDia, (mapaDias.get(nombreDia) || 0) + (Number(v.cantidad_pedidos) || 0));
    });

    const diasFinales = baseDias.map((d) => ({
      dia: d.dia,
      pedidos: mapaDias.get(d.dia) || 0
    }));
    setDatosSemana(diasFinales);

    // 3. Ventas por Categoría (100% dinámico)
    if (ventasPorCategoria.length > 0) {
      const totalVendidas = ventasPorCategoria.reduce(
        (acc, curr) => acc + (Number(curr.cantidadVendida) || 0),
        0
      );
      const categorizadas = ventasPorCategoria.map((c) => {
        const cantidad = Number(c.cantidadVendida) || 0;
        const porcentaje = totalVendidas > 0 ? Math.round((cantidad / totalVendidas) * 100) : 0;
        return {
          name: c.categoria,
          value: cantidad,
          etiqueta: `${c.categoria}: ${porcentaje}%`
        };
      });
      setDatosCategorias(categorizadas);
    } else {
      setDatosCategorias([]);
    }

    // 4. Mermas (100% dinámico con paleta cíclica)
    if (historialMermas.length > 0) {
      const mermasFormateadas = historialMermas.map((m, idx) => ({
        name: m.motivo || `Motivo ${idx + 1}`,
        value: Number(m.cantidad) || Number(m.cantidad_total) || 0,
        color: PALETA_MERMAS[idx % PALETA_MERMAS.length]
      }));
      setDatosMermas(mermasFormateadas);
    } else {
      setDatosMermas([]);
    }
  }, []);

  const cargarEstadisticas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await reporteService.obtenerEstadisticas();
      procesarDatos(data);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      setError(err.message || 'No se pudieron cargar las estadísticas.');
    } finally {
      setCargando(false);
    }
  }, [procesarDatos]);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const data = await reporteService.obtenerEstadisticas();
        if (activo) {
          procesarDatos(data);
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudieron cargar las estadísticas.');
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    iniciar();

    return () => {
      activo = false;
    };
  }, [procesarDatos]);

  return {
    cargando,
    error,
    recargar: cargarEstadisticas,
    datosFranja,
    datosSemana,
    datosCategorias,
    datosMermas
  };
}

export default useEstadisticas;
