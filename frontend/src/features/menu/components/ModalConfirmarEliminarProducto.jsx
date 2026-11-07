import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, ArrowLeft, Loader2 } from 'lucide-react';

export default function ModalConfirmarEliminarProducto({
  open,
  onOpenChange,
  producto,
  onConfirmar,
  cargando = false
}) {
  const [paso, setPaso] = useState('confirmar'); // 'confirmar' | 'motivo'

  useEffect(() => {
    if (open) {
      setPaso('confirmar');
    }
  }, [open, producto]);

  const handleSeleccionarMotivo = async (motivo) => {
    if (!producto || !onConfirmar) return;
    await onConfirmar(producto, motivo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100 p-0">
        {paso === 'confirmar' ? (
          <div>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  ¿Eliminar producto?
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <DialogDescription className="text-sm text-gray-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar el producto{' '}
                <strong className="text-gray-900 font-bold">"{producto?.nombre}"</strong>?
              </DialogDescription>
              <p className="text-xs text-muted-foreground">
                Esta acción dará de baja el producto del catálogo y a continuación se solicitará tipificar el motivo para la auditoría de caja y estadísticas.
              </p>
            </div>

            <DialogFooter className="p-4 bg-gray-50 border-t border-gray-100 flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={cargando}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setPaso('motivo')}
                disabled={cargando}
                className="bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
              >
                Confirmar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaso('confirmar')}
                  className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Motivo de eliminación
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <DialogDescription className="text-sm text-gray-600 mb-4">
                Seleccione la razón por la que elimina este producto:
              </DialogDescription>

              <button
                type="button"
                disabled={cargando}
                onClick={() => handleSeleccionarMotivo('Vencido')}
                className="w-full py-3 px-4 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-sm font-bold transition-colors border border-orange-200 cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                Vencido
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => handleSeleccionarMotivo('Merma')}
                className="w-full py-3 px-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors border border-red-200 cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                Merma
              </button>

              <button
                type="button"
                disabled={cargando}
                onClick={() => handleSeleccionarMotivo('En falta')}
                className="w-full py-3 px-4 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors border border-gray-200 cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {cargando && <Loader2 className="w-4 h-4 animate-spin" />}
                En falta
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

