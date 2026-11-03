import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import productoService from '@/services/productoService';
import { obtenerEmojiCategoria } from '../utils/categoriasHelper';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';

export default function CategoriasModal({
  open,
  onOpenChange,
  categorias = [],
  productos = [],
  onActualizarCategorias
}) {
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [creando, setCreando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  // Mapear productos asociados por ID de categoría
  const productosPorCategoria = productos.reduce((acc, p) => {
    acc[p.categoria_id] = (acc[p.categoria_id] || 0) + 1;
    return acc;
  }, {});

  const handleCrearCategoria = async (e) => {
    e.preventDefault();
    const nombreLimpio = nuevoNombre.trim().toUpperCase();

    if (!nombreLimpio) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    try {
      setCreando(true);
      await productoService.crearCategoria({ nombre: nombreLimpio });
      toast.success(`Categoría "${nombreLimpio}" creada con éxito`);
      setNuevoNombre('');
      setMostrarFormNuevo(false);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al crear la categoría');
    } finally {
      setCreando(false);
    }
  };

  const iniciarEdicion = (cat) => {
    setEditandoId(cat.id);
    setNombreEdicion(cat.nombre);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombreEdicion('');
  };

  const handleGuardarEdicion = async (id) => {
    const nombreLimpio = nombreEdicion.trim().toUpperCase();
    if (!nombreLimpio) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    try {
      setGuardandoEdicion(true);
      await productoService.actualizarCategoria(id, { nombre: nombreLimpio });
      toast.success('Categoría actualizada con éxito');
      setEditandoId(null);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al actualizar la categoría');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleEliminarCategoria = async (cat) => {
    const cantidadProductos = productosPorCategoria[cat.id] || 0;
    if (cantidadProductos > 0) {
      toast.error(`No podés eliminar "${cat.nombre}" porque tiene ${cantidadProductos} producto(s) asignado(s).`);
      return;
    }

    try {
      setEliminandoId(cat.id);
      await productoService.eliminarCategoria(cat.id);
      toast.success(`Categoría "${cat.nombre}" eliminada`);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar la categoría');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/20 text-card-foreground rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold text-primary tracking-tight">
            Categorías
          </DialogTitle>
        </DialogHeader>

        {/* Formulario condicional para Nueva Categoría */}
        {mostrarFormNuevo && (
          <form onSubmit={handleCrearCategoria} className="p-3 bg-background/60 border border-primary/20 rounded-xl space-y-2 mt-2">
            <span className="text-xs font-semibold text-primary">Nombre de la nueva categoría</span>
            <div className="flex items-center gap-2">
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej: CAFETERÍA, POSTRES..."
                className="h-9 bg-background border-primary/20 text-xs text-primary"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={creando || !nuevoNombre.trim()}
                className="h-9 bg-primary text-primary-foreground font-semibold px-3"
              >
                {creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMostrarFormNuevo(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Listado de Categorías (Fiel a la Imagen 4) */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 py-2">
          {categorias.length === 0 ? (
            <p className="text-sm text-primary/50 text-center py-8">
              No hay categorías cargadas aún.
            </p>
          ) : (
            categorias.map((cat) => {
              const emoji = obtenerEmojiCategoria(cat.nombre);
              const totalProds = productosPorCategoria[cat.id] || 0;
              const esEstaEditando = editandoId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl border border-primary/10 bg-background/50 hover:bg-background/80 transition-colors shadow-2xs"
                >
                  {esEstaEditando ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Input
                        value={nombreEdicion}
                        onChange={(e) => setNombreEdicion(e.target.value)}
                        className="h-8 text-xs bg-background border-primary/30"
                        autoFocus
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleGuardarEdicion(cat.id)}
                        disabled={guardandoEdicion}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={cancelarEdicion}
                        className="text-primary/60"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-base select-none">{emoji}</span>
                      <span className="font-semibold text-sm tracking-wide text-primary">
                        {cat.nombre.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {!esEstaEditando && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => iniciarEdicion(cat)}
                        title="Editar categoría"
                        className="p-1 rounded-md text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarCategoria(cat)}
                        disabled={eliminandoId === cat.id}
                        title={totalProds > 0 ? `Tiene ${totalProds} producto(s) asignado(s)` : 'Eliminar categoría'}
                        className="p-1 rounded-md text-primary/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {eliminandoId === cat.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer (Cerrar / + Agregar Categoría) */}
        <DialogFooter className="pt-3 flex flex-row items-center justify-between gap-3 border-t border-primary/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 bg-muted/60 border-transparent text-primary hover:bg-muted font-medium rounded-xl"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => setMostrarFormNuevo(true)}
            className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Agregar Categoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
