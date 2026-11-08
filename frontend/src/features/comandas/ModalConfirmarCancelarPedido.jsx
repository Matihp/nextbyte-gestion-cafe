import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

export default function ModalConfirmarCancelarPedido({
  open,
  onOpenChange,
  onConfirmar,
  cargando = false
}) {
  const [motivoSeleccionado, setMotivoSeleccionado] = useState(null); // 'MERMA' | 'OTROS'

  useEffect(() => {
    if (open) {
      setMotivoSeleccionado(null);
    }
  }, [open]);

  const handleConfirmar = async () => {
    if (!onConfirmar || !motivoSeleccionado) return;
    const esMerma = motivoSeleccionado === 'MERMA';
    await onConfirmar({
      esMerma,
      motivo: esMerma ? 'MERMA' : 'OTROS MOTIVOS'
    });
    onOpenChange(false);
  };

  const opciones = [
    {
      id: 'MERMA',
      label: 'ES MERMA',
      tooltip: 'Cuando se considera una perdida. Por ej. se cayo el cafe y no se pudo vender.',
      colorDefault: 'border-2 border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 hover:border-red-300',
      colorSelected: 'bg-red-600 text-white border-2 border-red-700 shadow-md ring-2 ring-red-300/80 scale-[1.02] font-black'
    },
    {
      id: 'OTROS',
      label: 'OTROS MOTIVOS',
      tooltip: 'Volverá al stock de productos',
      colorDefault: 'border-2 border-gray-300 bg-gray-50/80 text-gray-700 hover:bg-gray-100 hover:border-gray-400',
      colorSelected: 'bg-gray-900 text-white border-2 border-black shadow-md ring-2 ring-gray-400/80 scale-[1.02] font-black'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-white rounded-2xl shadow-xl max-w-xs sm:max-w-sm w-full overflow-hidden border border-gray-100 p-0"
      >
        <div>
          {/* Cabecera */}
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/40">
            <DialogTitle className="text-lg font-bold text-gray-900 tracking-tight">
              MOTIVO DE CANCELACION
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo: 2 cuadros de puntas a 90 grados con tooltips informativos */}
          <div className="py-7 px-6 flex flex-col items-center gap-4">
            {opciones.map((op) => {
              const isSelected = motivoSeleccionado === op.id;
              return (
                <div key={op.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setMotivoSeleccionado(op.id)}
                    className={`w-52 h-11 flex items-center justify-center font-bold text-sm tracking-wide rounded-none transition-all cursor-pointer select-none ${
                      isSelected
                        ? op.colorSelected
                        : `${op.colorDefault} shadow-2xs`
                    }`}
                  >
                    {op.label}
                  </button>

                  {/* Cartelito flotante al pasar el mouse (único tooltip, sin title nativo duplicado) */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 px-2.5 py-1.5 text-xs text-white bg-gray-900/95 rounded-md shadow-lg text-center max-w-[210px] w-max pointer-events-none transition-opacity">
                    {op.tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: Cancelar a la izquierda y Confirmar a la derecha */}
          <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cargando}
              className="px-5 py-2 rounded-lg cursor-pointer font-semibold text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
            >
              CANCELAR
            </Button>
            <Button
              type="button"
              onClick={handleConfirmar}
              disabled={!motivoSeleccionado || cargando}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {cargando && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              CONFIRMAR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

