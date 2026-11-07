import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { formatearPrecio } from '@/utils/formatters';

export function ModalConfirmarEliminar({
  movimiento,
  abierto,
  alCerrar,
  alConfirmar,
  cargando = false
}) {
  if (!abierto || !movimiento) return null;

  const esIngreso = movimiento.tipo === 'INGRESO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-border/30 flex flex-col">
        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border/20">
          <div className="flex items-center gap-2 text-destructive font-bold text-base">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span>Confirmar Eliminación</span>
          </div>
          <button
            onClick={alCerrar}
            disabled={cargando}
            className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-lg hover:bg-muted/20 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            ¿Estás seguro de que deseas eliminar este movimiento de la caja?
          </p>

          <div className="bg-[#FAF7F5] rounded-xl p-4 border border-border/30 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Tipo:</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  esIngreso
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {movimiento.tipo}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Detalle:</span>
              <span className="font-semibold text-primary text-right max-w-[240px] truncate">
                {movimiento.detalle}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-border/20">
              <span className="text-muted-foreground font-medium">Monto:</span>
              <span
                className={`font-black text-sm ${
                  esIngreso ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {formatearPrecio(movimiento.monto)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            {esIngreso
              ? 'Nota: Se verificará que existan fondos suficientes en la caja diaria antes de anular este ingreso.'
              : 'Nota: Al eliminar este retiro, el importe se reintegrará automáticamente al saldo de la caja.'}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex justify-end items-center gap-2.5 px-6 py-4 bg-[#FAF7F5] border-t border-border/20">
          <button
            type="button"
            onClick={alCerrar}
            disabled={cargando}
            className="px-4 py-2 text-xs font-semibold text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={alConfirmar}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{cargando ? 'Eliminando...' : 'Sí, Eliminar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalConfirmarEliminar;

