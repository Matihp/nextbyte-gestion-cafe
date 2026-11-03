import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import productoService from '@/services/productoService';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react';

export default function RecetasModal({
  open,
  onOpenChange,
  recetas = [],
  onEditarReceta,
  onCrearNuevaReceta,
  onRecetaEliminada
}) {
  const [eliminandoId, setEliminandoId] = useState(null);

  const handleEliminar = async (receta) => {
    try {
      setEliminandoId(receta.producto_id);
      await productoService.eliminarReceta(receta.producto_id);
      toast.success(`Receta "${receta.nombre}" eliminada con éxito`);
      if (onRecetaEliminada) onRecetaEliminada();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar la receta');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/20 text-card-foreground rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold text-primary tracking-tight">
            Recetas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Botón Destacado: + Agregar Nueva Receta (Fiel a Imagen 5) */}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onCrearNuevaReceta();
            }}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#F6E9DF] text-primary border border-primary/10 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#EEDFD3] transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Nueva Receta</span>
          </button>

          {/* Listado de Recetas (Fiel a Imagen 5) */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {recetas.length === 0 ? (
              <p className="text-xs text-primary/50 text-center py-8">
                No hay recetas registradas todavía.
              </p>
            ) : (
              recetas.map((receta) => (
                <div
                  key={receta.producto_id}
                  className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-primary/10 bg-background/50 hover:bg-background/80 transition-colors shadow-2xs"
                >
                  <span className="font-semibold text-sm text-primary">
                    {receta.nombre}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onEditarReceta(receta);
                      }}
                      title="Editar receta"
                      className="p-1 rounded-md text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminar(receta)}
                      disabled={eliminandoId === receta.producto_id}
                      title="Eliminar receta"
                      className="p-1 rounded-md text-primary/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {eliminandoId === receta.producto_id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
