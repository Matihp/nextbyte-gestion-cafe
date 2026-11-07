import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import productoService from '@/services/productoService';
import inventarioService from '@/services/inventarioService';
import { toast } from 'sonner';
import { X, ExternalLink, Trash2, Loader2 } from 'lucide-react';

export default function ProductoModal({
  open,
  onOpenChange,
  producto = null,
  categories = [],
  recipes = [],
  onSave,
  onViewRecipe,
  onDelete
}) {
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    price: 0,
    stock: 0,
    image: ''
  });

  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [recipeDetails, setRecipeDetails] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Cargar insumos para cálculo de costo de recetas
  useEffect(() => {
    if (open) {
      inventarioService.obtenerInsumos()
        .then((res) => setInsumos(Array.isArray(res) ? res : []))
        .catch(() => setInsumos([]));
    }
  }, [open]);

  useEffect(() => {
    if (producto) {
      setFormData({
        name: producto.nombre || '',
        categoryId: producto.categoria_id ? String(producto.categoria_id) : (categories[0]?.id ? String(categories[0].id) : ''),
        price: producto.precio_venta !== undefined ? Number(producto.precio_venta) : 0,
        stock: producto.stock_actual !== undefined ? Number(producto.stock_actual) : 0,
        image: producto.imagen || ''
      });

      // Buscar si el producto tiene receta
      const associatedRecipe = recipes.find(
        (r) => Number(r.producto_id) === Number(producto.id) || Number(r.id) === Number(producto.id)
      );

      if (associatedRecipe) {
        setSelectedRecipeId(String(associatedRecipe.producto_id || associatedRecipe.id));
        setRecipeDetails(associatedRecipe);
      } else {
        // Intentar obtener receta desde backend
        productoService.obtenerReceta(producto.id)
          .then((res) => {
            if (res && res.ingredientes && res.ingredientes.length > 0) {
              setSelectedRecipeId(String(producto.id));
              setRecipeDetails(res);
            } else {
              setSelectedRecipeId('');
              setRecipeDetails(null);
            }
          })
          .catch(() => {
            setSelectedRecipeId('');
            setRecipeDetails(null);
          });
      }
    } else {
      setFormData({
        name: '',
        categoryId: categories[0]?.id ? String(categories[0].id) : '',
        price: 0,
        stock: 0,
        image: ''
      });
      setSelectedRecipeId('');
      setRecipeDetails(null);
    }
  }, [producto, open, categories, recipes]);

  // Si cambia la receta seleccionada en el select, buscar los detalles de sus ingredientes
  useEffect(() => {
    if (!selectedRecipeId) {
      setRecipeDetails(null);
      return;
    }

    const rec = recipes.find(
      (r) => String(r.producto_id || r.id) === String(selectedRecipeId)
    );

    if (rec && rec.ingredientes) {
      setRecipeDetails(rec);
    } else {
      productoService.obtenerReceta(selectedRecipeId)
        .then((res) => {
          if (res && res.ingredientes) {
            setRecipeDetails(res);
          }
        })
        .catch(() => {});
    }
  }, [selectedRecipeId, recipes]);

  // Cálculo del costo en base a ingredientes e insumos
  const calculatedCost = useMemo(() => {
    if (!selectedRecipeId || !recipeDetails?.ingredientes) return 0;
    return recipeDetails.ingredientes.reduce((sum, ing) => {
      const insumo = insumos.find((i) => Number(i.id) === Number(ing.insumo_id));
      const costoUnitario = insumo ? Number(insumo.precio_costo || insumo.costo_unitario || 0) : 0;
      return sum + costoUnitario * Number(ing.cantidad || 0);
    }, 0);
  }, [selectedRecipeId, recipeDetails, insumos]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre del producto es obligatorio');
      return;
    }

    if (!formData.categoryId) {
      toast.error('Debe seleccionar una categoría');
      return;
    }

    const precioVentaNum = Number(formData.price);
    if (isNaN(precioVentaNum) || precioVentaNum < 0) {
      toast.error('El precio de venta debe ser un número válido mayor o igual a 0');
      return;
    }

    const stockNum = Number(formData.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      toast.error('El stock debe ser un número entero mayor o igual a 0');
      return;
    }

    const stockDiff = stockNum - (producto ? Number(producto.stock_actual || 0) : 0);

    // Validar disponibilidad de insumos en inventario si se aumentan unidades de un producto con receta
    if (stockDiff > 0 && selectedRecipeId && recipeDetails?.ingredientes?.length > 0) {
      for (const ing of recipeDetails.ingredientes) {
        const insumo = insumos.find((i) => Number(i.id) === Number(ing.insumo_id));
        const amountToDeduct = Number(ing.cantidad) * stockDiff;
        const totalAvailable = Number(insumo ? insumo.cantidad_disponible : 0);

        if (totalAvailable < amountToDeduct) {
          const missing = Number((amountToDeduct - totalAvailable).toFixed(3));
          const unidad = insumo?.unidad_medida || 'un';
          const nombreInsumo = insumo?.nombre || 'Insumo';
          toast.error(
            `No se podrá cargar el producto debido a que no hay suficiente stock de insumos en el inventario.\nFaltan ${missing} ${unidad} de "${nombreInsumo}".\n(Disponible en inventario: ${totalAvailable} ${unidad})`,
            { duration: 6000 }
          );
          return; // Bloquea el guardado
        }
      }
    }

    const payload = {
      nombre: formData.name.trim(),
      categoria_id: Number(formData.categoryId),
      precio_venta: precioVentaNum,
      stock_actual: stockNum,
      receta_id: selectedRecipeId ? Number(selectedRecipeId) : null,
      imagen: formData.image?.trim() ? formData.image.trim() : null
    };

    try {
      setCargando(true);
      if (producto) {
        await productoService.actualizarProducto(producto.id, payload);
        toast.success(
          stockDiff > 0 && selectedRecipeId
            ? `Producto "${payload.nombre}" actualizado y se descontaron los insumos del inventario`
            : `Producto "${payload.nombre}" actualizado con éxito`
        );
      } else {
        await productoService.crearProducto(payload);
        toast.success(
          stockNum > 0 && selectedRecipeId
            ? `Producto "${payload.nombre}" creado y se descontaron los insumos del inventario`
            : `Producto "${payload.nombre}" creado con éxito`
        );
      }

      onOpenChange(false);
      if (onSave) onSave();
    } catch (error) {
      toast.error(error.message || 'Error al guardar el producto');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="bg-white rounded-xl shadow-lg max-w-lg sm:max-w-lg w-full max-h-[90vh] flex flex-col p-0 border border-gray-200">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-gray-200">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {producto ? 'Editar Producto' : 'Agregar Nuevo Producto'}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                Nombre del Producto
              </Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#A67C52] text-sm bg-white"
                required
              />
            </div>

            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                Categoría
              </Label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A67C52] bg-white text-gray-900 text-sm h-10"
                required
              >
                <option value="" disabled>Seleccionar categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                Receta asociada
              </Label>
              <div className="flex gap-2">
                <select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A67C52] bg-white text-gray-900 text-sm h-10"
                >
                  <option value="">Sin receta</option>
                  {recipes.map((rec) => (
                    <option key={rec.producto_id || rec.id} value={rec.producto_id || rec.id}>
                      {rec.nombre}
                    </option>
                  ))}
                </select>
                {selectedRecipeId && onViewRecipe && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onViewRecipe(selectedRecipeId);
                    }}
                    className="p-2.5 bg-[#F3E5DC] text-[#4B2B1D] border border-[#F3E5DC] rounded-lg hover:bg-[#F3E5DC]/80 transition-colors flex items-center justify-center cursor-pointer"
                    title="Ver información de la receta"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                Precio (Costo)
              </Label>
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                ${calculatedCost.toFixed(2)}
                <span className="text-xs ml-2 text-gray-400">
                  {selectedRecipeId ? '(Calculado desde la receta)' : '(Requiere cargar receta)'}
                </span>
              </div>
            </div>

            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                Precio (Venta)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#A67C52] text-sm bg-white"
                required
              />
            </div>

            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                Stock Actual
              </Label>
              <Input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#A67C52] text-sm bg-white"
                required
              />
            </div>

            <div>
              <Label className="block text-sm mb-2 text-gray-700 font-normal">
                URL de la Imagen
              </Label>
              <Input
                type="text"
                placeholder=""
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#A67C52] text-sm bg-white"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100">
              {producto && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(producto);
                  }}
                  className="flex items-center justify-center p-2 px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0 cursor-pointer"
                  title="Eliminar producto"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={cargando}
                className="flex items-center justify-center flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium h-10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={cargando}
                className="flex items-center justify-center flex-1 px-4 py-2 bg-[#4B2B1D] text-white rounded-lg hover:bg-[#9F4F2F] transition-colors font-medium h-10 cursor-pointer"
              >
                {cargando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {producto ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
