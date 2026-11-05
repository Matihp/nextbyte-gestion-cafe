import React from 'react';
import { X, Printer } from 'lucide-react';
import { formatearPrecio, formatearSoloFecha } from '@/utils/formatters';

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

export function DetallePedidoModal({ pedido, abierto, alCerrar, alImprimir }) {
  if (!abierto || !pedido) return null;

  const idFormateado = String(pedido.id).startsWith('#') ? pedido.id : `#${pedido.id}`;
  const items = pedido.items && pedido.items.length > 0 ? pedido.items : [];

  const fechaTexto = pedido.fecha ? formatearSoloFecha(pedido.fecha) : '';
  const fechaHoraStr = `${fechaTexto} ${pedido.hora || ''}`.trim() || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md sm:max-w-lg overflow-hidden border border-border/30 flex flex-col max-h-[90vh]">
        {/* Barra superior con título y botón cerrar */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border/20">
          <h3 className="font-bold text-primary text-base">
            Detalles Internos {idFormateado}
          </h3>
          <button
            onClick={alCerrar}
            className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-lg hover:bg-muted/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido deslizable del ticket */}
        <div className="p-6 overflow-y-auto">
          <div className="bg-[#FAF7F5] rounded-2xl p-6 border border-border/30 space-y-4">
            {/* Encabezado del ticket */}
            <div className="text-center space-y-1">
              <h4 className="font-bold text-primary text-lg tracking-tight">Andén</h4>
              <p className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                Control Interno de Venta
              </p>
            </div>

            {/* Metadatos del pedido */}
            <div className="space-y-1.5 text-xs text-primary pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">ID:</span>
                <span className="font-bold">{idFormateado}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Cliente:</span>
                <span className="font-semibold">{pedido.cliente || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Fecha y Hora:</span>
                <span className="font-medium">{fechaHoraStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Tipo:</span>
                <span className="font-medium">{pedido.tipo_pedido || 'Mostrador'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Estado:</span>
                <span className="font-semibold">{formatEstadoNombre(pedido.estado)}</span>
              </div>
            </div>

            {/* Separador punteado */}
            <div className="border-t border-dashed border-border/40 my-3" />

            {/* Tabla de Artículos */}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/20">
                  <th className="text-left pb-1 font-bold">Artículo</th>
                  <th className="text-center pb-1 font-bold px-2 w-12">Cant</th>
                  <th className="text-right pb-1 font-bold px-2 whitespace-nowrap">Costo</th>
                  <th className="text-right pb-1 font-bold pl-2 whitespace-nowrap">Venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 font-medium text-primary pr-2">
                      {item.nombre_producto}
                    </td>
                    <td className="py-1.5 text-center text-primary font-medium px-2">
                      {item.cantidad}
                    </td>
                    <td className="py-1.5 text-right text-red-500 font-semibold px-2 whitespace-nowrap">
                      {formatearPrecio(item.costo_total)}
                    </td>
                    <td className="py-1.5 text-right text-emerald-600 font-bold pl-2 whitespace-nowrap">
                      {formatearPrecio(item.venta_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Separador punteado */}
            <div className="border-t border-dashed border-border/40 my-3" />

            {/* Medio de pago y Totales */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground font-medium">
                <span>Medio de pago:</span>
                <span className="text-primary font-semibold">{pedido.metodo_pago || 'Efectivo'}</span>
              </div>
              <div className="flex justify-between items-center text-red-500 font-bold">
                <span>TOTAL COSTOS:</span>
                <span>{formatearPrecio(pedido.total_costo)}</span>
              </div>
              <div className="flex justify-between items-center text-primary font-extrabold text-base pt-1 border-t border-border/20">
                <span>TOTAL VENTA:</span>
                <span className="text-lg">{formatearPrecio(pedido.total_venta)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-border/20 bg-gray-50/50">
          <button
            onClick={alCerrar}
            className="px-5 py-2 border border-border/40 bg-white hover:bg-muted/10 text-primary rounded-xl text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={() => alImprimir(pedido)}
            className="flex items-center gap-2 px-5 py-2 bg-[#4B2B1D] hover:bg-[#3D2314] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Registro</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DetallePedidoModal;

