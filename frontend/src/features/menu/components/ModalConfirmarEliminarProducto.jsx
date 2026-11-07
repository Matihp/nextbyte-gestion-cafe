import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';

export default function ModalConfirmarEliminarProducto({
  open,
  onOpenChange,
  producto,
  onConfirmar,
  cargando = false
}) {
  const [motivoSeleccionado, setMotivoSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState('1');
  const [esTodos, setEsTodos] = useState(false);
  const [errorStock, setErrorStock] = useState('');

  const stockDisponible = Math.max(0, Number(producto?.stock_actual ?? producto?.stock ?? 0));

  useEffect(() => {
    if (open) {
      setMotivoSeleccionado(null);
      setErrorStock('');
      if (stockDisponible > 0) {
        setCantidad('1');
        setEsTodos(false);
      } else {
        setCantidad('1');
        setEsTodos(true);
      }
    }
  }, [open, producto, stockDisponible]);

  const handleSeleccionarMotivo = (idMotivo) => {
    setMotivoSeleccionado(idMotivo);
    setErrorStock('');
    if (stockDisponible > 0) {
      setCantidad('1');
      setEsTodos(false);
    } else {
      setCantidad('1');
      setEsTodos(true);
    }
  };

  const handleSelectTodos = () => {
    setEsTodos(true);
    setCantidad(stockDisponible > 0 ? String(stockDisponible) : '1');
    setErrorStock('');
  };

  const handleCantidadChange = (e) => {
    const val = e.target.value;
    setCantidad(val);

    const num = Number(val);
    if (!val || isNaN(num) || num <= 0) {
      setErrorStock('Ingrese una cantidad válida mayor a 0');
      setEsTodos(false);
      return;
    }

    if (stockDisponible > 0 && num > stockDisponible) {
      setErrorStock(`No podrán eliminarse esa cantidad ya que hay ${stockDisponible} disponibles`);
      setEsTodos(false);
      return;
    }

    setErrorStock('');
    if (stockDisponible > 0 && num === stockDisponible) {
      setEsTodos(true);
    } else {
      setEsTodos(false);
    }
  };

  const handleConfirmar = async () => {
    if (!producto || !onConfirmar || !motivoSeleccionado) return;
    if (errorStock) return;

    const numCantidad = esTodos
      ? (stockDisponible > 0 ? stockDisponible : 1)
      : (Number(cantidad) || 1);

    await onConfirmar(producto, motivoSeleccionado, numCantidad, esTodos || (stockDisponible > 0 && numCantidad >= stockDisponible));
    onOpenChange(false);
  };

  const motivos = [
    {
      id: 'Vencido',
      label: 'Vencido',
      colorClasses: 'border border-[#FBD38D] bg-[#FFF9F2] text-[#C05621]'
    },
    {
      id: 'Merma',
      label: 'Merma',
      colorClasses: 'border border-[#FEB2B2] bg-[#FFF5F5] text-[#C53030]'
    },
    {
      id: 'En falta',
      label: 'En falta',
      colorClasses: 'border border-[#E2E8F0] bg-[#F7FAFC] text-[#2D3748]'
    }
  ];

  const motivoActivo = motivos.find((m) => m.id === motivoSeleccionado);

  const botonConfirmarDeshabilitado =
    !motivoSeleccionado ||
    cargando ||
    Boolean(errorStock) ||
    (!esTodos && (!cantidad || Number(cantidad) <= 0));

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
              Motivo de eliminación
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

          {/* Cuerpo */}
          <div className="py-6 px-6 flex flex-col items-center gap-4">
            {!motivoSeleccionado ? (
              /* Mostrar los 3 motivos cuando ninguno ha sido seleccionado */
              motivos.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSeleccionarMotivo(m.id)}
                  className={`w-52 h-11 flex items-center justify-center font-bold text-sm tracking-wide rounded-none transition-all cursor-pointer select-none ${m.colorClasses} opacity-100 blur-none hover:opacity-90 shadow-2xs`}
                >
                  {m.label}
                </div>
              ))
            ) : (
              /* Cuando se seleccionó un motivo: desaparecen los otros, el seleccionado se ubica arriba blureado/aclarado */
              <div className="w-full flex flex-col items-center gap-4">
                <div
                  onClick={() => setMotivoSeleccionado(null)}
                  title="Click para cambiar motivo"
                  className={`w-52 h-11 flex items-center justify-center font-bold text-sm tracking-wide rounded-none transition-all cursor-pointer select-none ${motivoActivo?.colorClasses} opacity-50 blur-[0.5px] ring-2 ring-gray-400 scale-[0.98]`}
                >
                  {motivoActivo?.label}
                </div>

                {/* Sección Cantidad de unidades y botón TODOS */}
                <div className="w-full max-w-[280px] flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700 tracking-tight whitespace-nowrap">
                      CANTIDAD DE UNIDADES:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max={stockDisponible > 0 ? stockDisponible : undefined}
                        value={cantidad}
                        onChange={handleCantidadChange}
                        className="w-14 h-9 px-1.5 text-center text-xs font-bold border border-gray-300 rounded-none bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                      <button
                        type="button"
                        onClick={handleSelectTodos}
                        className={`h-9 px-2.5 text-xs font-bold uppercase rounded-none border border-gray-300 transition-all cursor-pointer select-none ${
                          esTodos
                            ? 'bg-gray-100 opacity-50 blur-[0.5px] ring-2 ring-gray-400 text-gray-800'
                            : 'bg-white hover:bg-gray-50 text-gray-700 shadow-2xs'
                        }`}
                      >
                        TODOS
                      </button>
                    </div>
                  </div>

                  {/* Mensaje de validación de stock disponible */}
                  {errorStock && (
                    <p className="text-[11px] font-semibold text-red-600 text-center mt-1 leading-snug">
                      {errorStock}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer: Botones Cancelar a la izquierda y Confirmar a la derecha */}
          <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cargando}
              className="px-5 py-2 rounded-lg cursor-pointer font-semibold text-xs sm:text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmar}
              disabled={botonConfirmarDeshabilitado}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {cargando && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
