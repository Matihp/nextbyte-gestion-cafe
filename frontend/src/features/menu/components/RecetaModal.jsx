import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import productoService from '@/services/productoService';
import inventarioService from '@/services/inventarioService';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, BookOpen, Utensils } from 'lucide-react';

export default function RecetaModal({
  open,
  onOpenChange,
  producto = null,
  onRecetaGuardada
}) {
  const [nombreReceta, setNombreReceta] = useState('');
  const [ingredientes, setIngredientes] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [tieneRecetaPrevia, setTieneRecetaPrevia] = useState(false);

  // Selector para agregar ingrediente
  const [insumoSeleccionadoId, setInsumoSeleccionadoId] = useState('');
  const [cantidadIngrediente, setCantidadIngrediente] = useState('');

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (!open || !producto) return;

    const cargarDatos = async () => {
      try {
        setCargando(true);
        // Cargar receta e insumos en paralelo
        const [recetaRes, insumosRes] = await Promise.all([
          productoService.obtenerReceta(producto.id),
          inventarioService.obtenerInsumos()
        ]);

        const insumosList = Array.isArray(insumosRes) ? insumosRes : [];
        setInsumosDisponibles(insumosList);

        if (recetaRes && recetaRes.ingredientes && recetaRes.ingredientes.length > 0) {
          setTieneRecetaPrevia(true);
          setNombreReceta(recetaRes.nombre || `Receta de ${producto.nombre}`);
          setIngredientes(recetaRes.ingredientes);
        } else {
          setTieneRecetaPrevia(false);
          setNombreReceta(`Receta de ${producto.nombre}`);
          setIngredientes([]);
        }

        // Reset inputs de agregar
        setInsumoSeleccionadoId(insumosList.length > 0 ? String(insumosList[0].id) : '');
        setCantidadIngrediente('');
      } catch (error) {
        toast.error(error.message || 'Error al cargar la información de la receta');
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [open, producto]);

  const insumoActual = insumosDisponibles.find(
    (ins) => String(ins.id) === String(insumoSeleccionadoId)
  );

  const handleAgregarIngrediente = () => {
    if (!insumoSeleccionadoId) {
      toast.error('Debe seleccionar un insumo');
      return;
    }

    const cantidadNum = parseFloat(cantidadIngrediente);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const yaExiste = ingredientes.some(
      (item) => String(item.insumo_id) === String(insumoSeleccionadoId)
    );

    if (yaExiste) {
      toast.error('Este insumo ya está en la receta. Modifique la cantidad o elimínelo primero.');
      return;
    }

    const nuevoItem = {
      insumo_id: Number(insumoSeleccionadoId),
      insumo_nombre: insumoActual?.nombre || 'Insumo',
      unidad_medida: insumoActual?.unidad_medida || 'un',
      cantidad: cantidadNum
    };

    setIngredientes([...ingredientes, nuevoItem]);
    setCantidadIngrediente('');
  };

  const handleQuitarIngrediente = (insumoId) => {
    setIngredientes(ingredientes.filter((item) => item.insumo_id !== insumoId));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();

    if (!nombreReceta.trim()) {
      toast.error('El nombre de la receta es obligatorio');
      return;
    }

    if (ingredientes.length === 0) {
      toast.error('La receta debe contener al menos un ingrediente');
      return;
    }

    const payload = {
      nombre: nombreReceta.trim(),
      ingredientes: ingredientes.map((i) => ({
        insumo_id: Number(i.insumo_id),
        cantidad: Number(i.cantidad)
      }))
    };

    try {
      setGuardando(true);
      await productoService.guardarReceta(producto.id, payload);
      toast.success(`Receta de "${producto.nombre}" guardada con éxito`);
      onOpenChange(false);
      if (onRecetaGuardada) onRecetaGuardada();
    } catch (error) {
      toast.error(error.message || 'Error al guardar la receta');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarReceta = async () => {
    try {
      setEliminando(true);
      await productoService.eliminarReceta(producto.id);
      toast.success(`Receta de "${producto.nombre}" eliminada`);
      onOpenChange(false);
      if (onRecetaGuardada) onRecetaGuardada();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar la receta');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-primary/20 text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            Receta: {producto?.nombre || 'Producto'}
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-primary/60">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm font-medium">Cargando receta e insumos...</p>
          </div>
        ) : (
          <form onSubmit={handleGuardar} className="space-y-4 pt-1">
            {/* Nombre de la Receta */}
            <div className="space-y-1.5">
              <Label htmlFor="receta-nombre" className="text-xs font-semibold text-primary">
                Nombre de la Receta *
              </Label>
              <Input
                id="receta-nombre"
                value={nombreReceta}
                onChange={(e) => setNombreReceta(e.target.value)}
                placeholder="Ej: Receta de Espresso"
                maxLength={100}
                required
                className="bg-background/50 border-primary/20 text-primary focus-visible:ring-primary/20"
              />
            </div>

            {/* Agregar Ingrediente */}
            <div className="p-3 rounded-xl border border-primary/15 bg-background/30 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-primary/70 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-accent" />
                Agregar Ingrediente
              </Label>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                {/* Selector de Insumo */}
                <select
                  value={insumoSeleccionadoId}
                  onChange={(e) => setInsumoSeleccionadoId(e.target.value)}
                  className="h-9 w-full sm:flex-1 rounded-lg border border-primary/20 bg-background px-2.5 text-xs text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {insumosDisponibles.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nombre} ({ins.unidad_medida})
                    </option>
                  ))}
                </select>

                {/* Cantidad e Insumo */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="Cant."
                    value={cantidadIngrediente}
                    onChange={(e) => setCantidadIngrediente(e.target.value)}
                    className="w-24 h-9 bg-background border-primary/20 text-xs text-primary focus-visible:ring-primary/20"
                  />
                  <Badge variant="outline" className="h-9 px-2 text-xs border-primary/20 shrink-0">
                    {insumoActual?.unidad_medida || 'un'}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAgregarIngrediente}
                    className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Sumar
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Ingredientes en la Receta */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-primary/70">
                  Ingredientes en la receta ({ingredientes.length})
                </Label>
                <span className="text-[11px] text-primary/50">Mínimo 1 ingrediente</span>
              </div>

              {ingredientes.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-primary/20 rounded-xl bg-background/20 text-primary/60 text-xs">
                  Todavía no agregaste ningún insumo a esta receta.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {ingredientes.map((item) => (
                    <div
                      key={item.insumo_id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-primary/10 bg-background/50 hover:bg-background/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-primary">{item.insumo_nombre}</span>
                        <Badge variant="secondary" className="bg-muted text-primary text-[10px] font-mono">
                          {item.cantidad} {item.unidad_medida}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleQuitarIngrediente(item.insumo_id)}
                        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        title="Quitar de la receta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer con Guardar / Eliminar */}
            <DialogFooter className="pt-3 flex flex-col sm:flex-row sm:justify-between gap-2 border-t border-primary/10">
              {tieneRecetaPrevia ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleEliminarReceta}
                  disabled={eliminando || guardando}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  {eliminando && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Eliminar Receta
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={guardando || eliminando}
                  className="border-primary/20 text-primary hover:bg-muted/40"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={guardando || eliminando || ingredientes.length === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                >
                  {guardando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar Receta
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

