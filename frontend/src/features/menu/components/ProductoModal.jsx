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
import productoService from '@/services/productoService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ProductoModal({
  open,
  onOpenChange,
  producto = null,
  categorias = [],
  recetasDisponibles = [],
  onGuardado
}) {
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [recetaAsociada, setRecetaAsociada] = useState('sin-receta');
  const [precioCostoTexto, setPrecioCostoTexto] = useState('$0.00 (Requiere cargar receta)');
  const [precioVenta, setPrecioVenta] = useState('0');
  const [stockActual, setStockActual] = useState('0');
  const [imagen, setImagen] = useState('');
  const [cargando, setCargando] = useState(false);

  const esEdicion = Boolean(producto?.id);

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre || '');
      setCategoriaId(producto.categoria_id ? String(producto.categoria_id) : '');
      setPrecioVenta(producto.precio_venta !== undefined ? String(producto.precio_venta) : '0');
      setStockActual(producto.stock_actual !== undefined ? String(producto.stock_actual) : '0');
      setImagen(producto.imagen || '');

      // Verificar si tiene receta
      productoService.obtenerReceta(producto.id)
        .then((res) => {
          if (res && res.ingredientes && res.ingredientes.length > 0) {
            setRecetaAsociada(String(producto.id));
            setPrecioCostoTexto('$0.00');
          } else {
            setRecetaAsociada('sin-receta');
            setPrecioCostoTexto('$0.00 (Requiere cargar receta)');
          }
        })
        .catch(() => {
          setRecetaAsociada('sin-receta');
          setPrecioCostoTexto('$0.00 (Requiere cargar receta)');
        });
    } else {
      setNombre('');
      setCategoriaId(categorias.length > 0 ? String(categorias[0].id) : '');
      setRecetaAsociada('sin-receta');
      setPrecioCostoTexto('$0.00 (Requiere cargar receta)');
      setPrecioVenta('0');
      setStockActual('0');
      setImagen('');
    }
  }, [producto, open, categorias]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.error('El nombre del producto es obligatorio');
      return;
    }

    if (!categoriaId) {
      toast.error('Debe seleccionar una categoría');
      return;
    }

    const precio = Number(precioVenta);
    if (isNaN(precio) || precio <= 0) {
      toast.error('El precio de venta debe ser un número mayor a 0');
      return;
    }

    const stock = Number(stockActual);
    if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      toast.error('El stock actual debe ser un número entero mayor o igual a 0');
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      categoria_id: Number(categoriaId),
      precio_venta: precio,
      stock_actual: stock,
      imagen: imagen.trim() ? imagen.trim() : null
    };

    try {
      setCargando(true);
      if (esEdicion) {
        await productoService.actualizarProducto(producto.id, payload);
        toast.success(`Producto "${payload.nombre}" actualizado con éxito`);
      } else {
        await productoService.crearProducto(payload);
        toast.success(`Producto "${payload.nombre}" creado con éxito`);
      }
      onOpenChange(false);
      if (onGuardado) onGuardado();
    } catch (error) {
      toast.error(error.message || 'Error al guardar el producto');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/20 text-card-foreground rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold text-primary tracking-tight">
            {esEdicion ? 'Editar Producto' : 'Agregar Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Nombre del Producto */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-xs font-semibold text-primary">
              Nombre del Producto
            </Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Espresso"
              maxLength={100}
              required
              className="h-10 bg-background/50 border-primary/20 text-primary rounded-xl focus-visible:ring-primary/20"
            />
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label htmlFor="categoria" className="text-xs font-semibold text-primary">
              Categoría
            </Label>
            <select
              id="categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              required
              className="h-10 w-full rounded-xl border border-secondary/50 bg-background/60 px-3 text-sm text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="" disabled>Seleccionar categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Receta asociada */}
          <div className="space-y-1.5">
            <Label htmlFor="receta-asociada" className="text-xs font-semibold text-primary">
              Receta asociada
            </Label>
            <select
              id="receta-asociada"
              value={recetaAsociada}
              onChange={(e) => {
                setRecetaAsociada(e.target.value);
                if (e.target.value === 'sin-receta') {
                  setPrecioCostoTexto('$0.00 (Requiere cargar receta)');
                } else {
                  setPrecioCostoTexto('$0.00');
                }
              }}
              className="h-10 w-full rounded-xl border border-secondary/30 bg-background/60 px-3 text-sm text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="sin-receta">Sin receta</option>
              {recetasDisponibles.map((r) => (
                <option key={r.id} value={r.producto_id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Precio (Costo) - Read-only */}
          <div className="space-y-1.5">
            <Label htmlFor="precio-costo" className="text-xs font-semibold text-primary">
              Precio (Costo)
            </Label>
            <Input
              id="precio-costo"
              value={precioCostoTexto}
              disabled
              readOnly
              className="h-10 bg-background/40 border-primary/10 text-muted-foreground rounded-xl cursor-not-allowed text-sm"
            />
          </div>

          {/* Precio (Venta) */}
          <div className="space-y-1.5">
            <Label htmlFor="precio" className="text-xs font-semibold text-primary">
              Precio (Venta)
            </Label>
            <Input
              id="precio"
              type="number"
              step="0.01"
              min="0.01"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              placeholder="0"
              required
              className="h-10 bg-background/50 border-primary/20 text-primary rounded-xl focus-visible:ring-primary/20"
            />
          </div>

          {/* Stock Actual */}
          <div className="space-y-1.5">
            <Label htmlFor="stock" className="text-xs font-semibold text-primary">
              Stock Actual
            </Label>
            <Input
              id="stock"
              type="number"
              step="1"
              min="0"
              value={stockActual}
              onChange={(e) => setStockActual(e.target.value)}
              placeholder="0"
              className="h-10 bg-background/50 border-primary/20 text-primary rounded-xl focus-visible:ring-primary/20"
            />
          </div>

          {/* URL de la Imagen */}
          <div className="space-y-1.5">
            <Label htmlFor="imagen" className="text-xs font-semibold text-primary">
              URL de la Imagen
            </Label>
            <Input
              id="imagen"
              type="url"
              value={imagen}
              onChange={(e) => setImagen(e.target.value)}
              placeholder="https://images.unsplash.com/photo-164544456"
              className="h-10 bg-background/50 border-primary/20 text-primary rounded-xl focus-visible:ring-primary/20"
            />
          </div>

          {/* Footer de Acciones (Cancelar / Agregar) */}
          <DialogFooter className="pt-4 flex flex-row items-center justify-between gap-3 border-t border-primary/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={cargando}
              className="flex-1 h-11 bg-muted/60 border-transparent text-primary hover:bg-muted font-medium rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={cargando}
              className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl shadow-xs"
            >
              {cargando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {esEdicion ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
