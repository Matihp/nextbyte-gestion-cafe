import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Footprints,
  Bike,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { inventarioService } from '@/services/inventarioService';
import { comandaService } from '@/services/comandaService';

const getBadgeEstado = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  switch (s) {
    case 'en_empaque':
    case 'en empaque':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'en_preparacion':
    case 'en preparación':
    case 'en preparacion':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'completado':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'entregado':
      return 'bg-teal-50 text-teal-800 border border-teal-200';
    case 'cancelado':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'pendiente':
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

const formatEstadoNombre = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  if (s === 'en_empaque') return 'En empaque';
  if (s === 'en_preparacion' || s === 'en preparacion') return 'En preparación';
  if (s === 'completado') return 'Completado';
  if (s === 'entregado') return 'Entregado';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendiente') return 'Pendiente';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function TarjetaPedido({ pedido }) {
  const items = pedido.detalles || pedido.items || [];

  return (
    <div className="bg-[#FAF7F5] border border-border/30 rounded-xl p-4 space-y-2.5 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start gap-2">
        <div>
          <span className="font-bold text-primary text-sm tracking-tight">#{pedido.id}</span>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {pedido.cliente || pedido.customer || 'Consumidor Final'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-muted-foreground font-medium block">
            {pedido.hora ? String(pedido.hora).slice(0, 5) : '-'}
          </span>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mt-1 whitespace-nowrap ${getBadgeEstado(
              pedido.estado || pedido.status
            )}`}
          >
            {formatEstadoNombre(pedido.estado || pedido.status)}
          </span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="pt-2 border-t border-border/20 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs text-primary/90 font-medium">
              <span>
                {item.cantidad || item.quantity || 1}x {item.nombre_producto || item.name || 'Producto'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [insumos, setInsumos] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resInsumos, resComandas] = await Promise.allSettled([
        inventarioService.obtenerInsumos(),
        comandaService.obtenerActivas()
      ]);

      if (resInsumos.status === 'fulfilled') {
        const rawInsumos = resInsumos.value;
        const listaInsumos = Array.isArray(rawInsumos)
          ? rawInsumos
          : rawInsumos?.data || [];
        setInsumos(listaInsumos);
      } else {
        console.error('Error al cargar insumos:', resInsumos.reason);
      }

      if (resComandas.status === 'fulfilled') {
        const rawComandas = resComandas.value;
        const listaComandas = Array.isArray(rawComandas)
          ? rawComandas
          : rawComandas?.data || [];
        setComandas(listaComandas);
      } else {
        console.error('Error al cargar comandas activas:', resComandas.reason);
      }
    } catch (err) {
      console.error('Error general al cargar panel:', err);
      setError(err.message || 'No se pudieron cargar los datos del panel.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Cálculos de Stock / Insumos para las 4 Tarjetas
  const metricasStock = useMemo(() => {
    let agotadosCriticos = 0;
    let bajoMinimo = 0;
    let proximosVencimientos = 0;
    let saludables = 0;

    for (const i of insumos) {
      const cantidad = Number(i.cantidad_disponible) || 0;
      const stockMinimo = Number(i.stock_minimo) || 0;
      const estado = i.estado_stock || (cantidad <= stockMinimo ? 'critico' : 'ok');

      if (cantidad === 0 || estado === 'critico') {
        agotadosCriticos += 1;
      } else if (estado === 'bajo' || (cantidad > 0 && cantidad <= stockMinimo * 1.5)) {
        bajoMinimo += 1;
      } else if (estado === 'ok' || cantidad > stockMinimo * 1.5) {
        saludables += 1;
      }

      if (i.por_vencer) {
        proximosVencimientos += 1;
      }
    }

    return {
      agotadosCriticos,
      bajoMinimo,
      proximosVencimientos,
      saludables
    };
  }, [insumos]);

  // Categorización de Comandas Activas en 3 Columnas
  const pedidosPorCanal = useMemo(() => {
    const mostrador = [];
    const takeAway = [];
    const delivery = [];

    for (const p of comandas) {
      const canal = String(p.tipo_pedido || p.orderType || '').toLowerCase().trim();

      if (canal === 'mostrador' || canal === 'salon' || canal === 'salón' || canal === 'mesa') {
        mostrador.push(p);
      } else if (canal === 'take_away' || canal === 'take away' || canal === 'takeaway' || canal.includes('llevar')) {
        takeAway.push(p);
      } else if (canal === 'delivery' || canal.includes('envio') || canal.includes('envío')) {
        delivery.push(p);
      } else {
        // Fallback por defecto a mostrador si no especifica
        mostrador.push(p);
      }
    }

    return {
      mostrador,
      takeAway,
      delivery
    };
  }, [comandas]);

  if (cargando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-primary gap-3">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">Cargando panel de control...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-border/30 shadow-sm text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <div>
          <h3 className="font-semibold text-primary text-base">Error al cargar el panel</h3>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
        <button
          onClick={cargarDatos}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">

      {/* SECCIÓN SUPERIOR: 4 Tarjetas de Métricas de Insumos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* 1. Stock Agotado / Crítico */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-red-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-gray-600">Stock Agotado / Crítico</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-red-600 tracking-tight">
              {metricasStock.agotadosCriticos} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Requiere compra inmediata
          </p>
        </div>

        {/* 2. Stock Bajo Mínimo */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-amber-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-gray-600">Stock Bajo Mínimo</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-amber-500 tracking-tight">
              {metricasStock.bajoMinimo} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Planificar próxima compra
          </p>
        </div>

        {/* 3. Próximos Vencimientos */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-orange-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-gray-600">Próximos Vencimientos</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-orange-500 tracking-tight">
              {metricasStock.proximosVencimientos} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Verificar insumos
          </p>
        </div>

        {/* 4. Stock Saludable */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-emerald-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-gray-600">Stock Saludable</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              {metricasStock.saludables} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Niveles óptimos
          </p>
        </div>

      </div>

      {/* SECCIÓN INFERIOR: 3 Columnas de Pedidos Activos por Canal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* COLUMNA 1: Mostrador */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/20 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 pb-4 border-b border-border/10 mb-4">
            <span className="text-lg leading-none" role="img" aria-label="Campana Mostrador">
              🛎️
            </span>
            <h3 className="text-base font-bold text-primary tracking-tight">Mostrador</h3>
            {pedidosPorCanal.mostrador.length > 0 && (
              <span className="ml-auto text-xs font-bold text-primary bg-muted/30 px-2 py-0.5 rounded-full">
                {pedidosPorCanal.mostrador.length}
              </span>
            )}
          </div>

          {pedidosPorCanal.mostrador.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground/60 font-medium">No hay pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {pedidosPorCanal.mostrador.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} />
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA 2: Take away */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/20 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 pb-4 border-b border-border/10 mb-4">
            <span className="text-lg leading-none" role="img" aria-label="Take away">
              🏃
            </span>
            <h3 className="text-base font-bold text-primary tracking-tight">Take away</h3>
            {pedidosPorCanal.takeAway.length > 0 && (
              <span className="ml-auto text-xs font-bold text-primary bg-muted/30 px-2 py-0.5 rounded-full">
                {pedidosPorCanal.takeAway.length}
              </span>
            )}
          </div>

          {pedidosPorCanal.takeAway.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground/60 font-medium">No hay pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {pedidosPorCanal.takeAway.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} />
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA 3: Delivery */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/20 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 pb-4 border-b border-border/10 mb-4">
            <span className="text-lg leading-none" role="img" aria-label="Delivery">
              🛵
            </span>
            <h3 className="text-base font-bold text-primary tracking-tight">Delivery</h3>
            {pedidosPorCanal.delivery.length > 0 && (
              <span className="ml-auto text-xs font-bold text-primary bg-muted/30 px-2 py-0.5 rounded-full">
                {pedidosPorCanal.delivery.length}
              </span>
            )}
          </div>

          {pedidosPorCanal.delivery.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground/60 font-medium">No hay pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {pedidosPorCanal.delivery.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} />
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
