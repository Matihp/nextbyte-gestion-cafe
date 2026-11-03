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
import { Plus, Trash2, Loader2, Utensils, BookOpen } from 'lucide-react';

export default function RecetaEditorModal({
  open,
  onOpenChange,
  producto = null,
  productos = [],
  onRecetaGuardada
}) {
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('');
  const [nombreReceta, setNombreReceta] = useState('');
  const [ingredientes, setIngredientes] = useState([]);
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);

  // Selector para agregar ingrediente
  const [insumoId, setInsumoId] = useState('');
  const [cantidad, setCantidad] = useState('');

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;

    const inicializar = async () => {
      try {
        setCargando(true);
        const insumosRes = await inventarioService.obtenerInsumos();
        const listaInsumos = Array.isArray(insumosRes) ? insumosRes : [];
        setInsumosDisponibles(listaInsumos);
        if (listaInsumos.length > 0) {
          setInsumoId(String(listaInsumos[0].id));
        }

        if (producto) {
          setProductoSeleccionadoId(String(producto.id));
          const recetaRes = await productoService.obtenerReceta(producto.id);
          if (recetaRes && recetaRes.ingredientes) {
            setNombreReceta(recetaRes.nombre || producto.nombre);
            setIngredientes(recetaRes.ingredientes);
          } else {
            setNombreReceta(producto.nombre);
            setIngredientes([]);
          }
        } else {
          const prodInicial = productos[0];
          setProductoSeleccionadoId(prodInicial ? String(prodInicial.id) : '');
          setNombreReceta(prodInicial ? prodInicial.nombre : '');
          setIngredientes([]);
        }
      } catch (error) {
        toast.error(error.message || 'Error al cargar insumos');
      } finally {
        setCargando(false);
      }
    };

    inicializar();
  }, [open, producto, productos]);

  const insumoActual = insumosDisponibles.find((i) => String(i.id) === String(insumoId));

  const handleAgregarIngrediente = () => {
    if (!insumoId) {
      toast.error('Debe seleccionar un insumo');
      return;
    }

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const yaExiste = ingredientes.some((i) => String(i.insumo_id) === String(insumoId));
    if (yaExiste) {
      toast.error('El insumo ya está en la receta');
      return;
    }

    setIngredientes([
      ...ingredientes,
      {
        insumo_id: Number(insumoId),
        insumo_nombre: insumoActual?.nombre || 'Insumo',
        unidad_medida: insumoActual?.unidad_medida || 'un',
        cantidad: cantNum
      }
    ]);
    setCantidad('');
  };

  const handleQuitarIngrediente = (id) => {
    setIngredientes(ingredientes.filter((i) => i.insumo_id !== id));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();

    const prodId = Number(productoSeleccionadoId);
    if (!prodId) {
      toast.error('Debe seleccionar un producto para asociar la receta');
      return;
    }

    if (!nombreReceta.trim()) {
      toast.error('El nombre de la receta es obligatorio');
      return;
    }

    if (ingredientes.length === 0) {
      toast.error('La receta debe contener al menos 1 ingrediente');
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
      await productoService.guardarReceta(prodId, payload);
      toast.success(`Receta "${payload.nombre}" guardada con éxito`);
      onOpenChange(false);
      if (onRecetaGuardada) onRecetaGuardada();
    } catch (error) {
      toast.error(error.message || 'Error al guardar la receta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/20 text-card-foreground rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            {producto ? `Editar Receta: ${producto.nombre}` : 'Agregar Nueva Receta'}
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-primary/60">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm font-medium">Cargando...</p>
          </div>
        ) : (
          <form onSubmit={handleGuardar} className="space-y-4 pt-1">
            {/* Selección de Producto (si es nueva) */}
            {!producto && (
              <div className="space-y-1.5">
                <Label htmlFor="producto-receta" className="text-xs font-semibold text-primary">
                  Producto a asociar
                </Label>
                <select
                  id="producto-receta"
                  value={productoSeleccionadoId}
                  onChange={(e) => {
                    setProductoSeleccionadoId(e.target.value);
                    const prod = productos.find((p) => String(p.id) === e.target.value);
                    if (prod) setNombreReceta(prod.nombre);
                  }}
                  className="h-10 w-full rounded-xl border border-secondary/40 bg-background/60 px-3 text-sm text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.categoria_nombre || 'Sin categoría'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Nombre de la Receta */}
            <div className="space-y-1.5">
              <Label htmlFor="receta-nombre" className="text-xs font-semibold text-primary">
                Nombre de la Receta
              </Label>
              <Input
                id="receta-nombre"
                value={nombreReceta}
                onChange={(e) => setNombreReceta(e.target.value)}
                placeholder="Ej: Medialuna Andén"
                required
                className="h-10 bg-background/50 border-primary/20 text-primary rounded-xl"
              />
            </div>

            {/* Agregar Insumos */}
            <div className="p-3 rounded-2xl border border-primary/15 bg-background/40 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary/70 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-accent" />
                Insumos necesarios
              </span>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <select
                  value={insumoId}
                  onChange={(e) => setInsumoId(e.target.value)}
                  className="h-9 w-full sm:flex-1 rounded-xl border border-primary/20 bg-background px-2.5 text-xs text-primary transition-colors outline-none"
                >
                  {insumosDisponibles.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nombre} ({ins.unidad_medida})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="Cant."
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-20 h-9 bg-background border-primary/20 text-xs text-primary rounded-xl"
                  />
                  <Badge variant="outline" className="h-9 px-2 text-xs border-primary/20 shrink-0">
                    {insumoActual?.unidad_medida || 'un'}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAgregarIngrediente}
                    className="h-9 bg-primary text-primary-foreground font-semibold px-3 rounded-xl shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Sumar
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Ingredientes Agregados */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-primary/60">
                Ingredientes en la receta ({ingredientes.length})
              </Label>
              {ingredientes.length === 0 ? (
                <p className="text-xs text-primary/50 text-center py-4 border border-dashed border-primary/20 rounded-xl">
                  Sin ingredientes cargados aún.
                </p>
              ) : (
                ingredientes.map((item) => (
                  <div
                    key={item.insumo_id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-primary/10 bg-background/50 text-xs"
                  >
                    <span className="font-semibold text-primary">{item.insumo_nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-primary/70">{item.cantidad} {item.unidad_medida}</span>
                      <button
                        type="button"
                        onClick={() => handleQuitarIngrediente(item.insumo_id)}
                        className="text-destructive/70 hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-between gap-3 border-t border-primary/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={guardando}
                className="flex-1 h-11 bg-muted/60 border-transparent text-primary hover:bg-muted font-medium rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={guardando || ingredientes.length === 0}
                className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl"
              >
                {guardando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar Receta
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

