import { useState, useEffect } from 'react';
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
import { X, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { formatearPrecio } from '@/utils/formatters';

export default function RecetasModal({
  open,
  onOpenChange,
  recetas = [],
  initialEditRecipeId = null,
  onRecetaGuardada
}) {
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Cargar insumos
  useEffect(() => {
    if (open) {
      inventarioService.obtenerInsumos()
        .then((res) => setInsumos(Array.isArray(res) ? res : []))
        .catch(() => setInsumos([]));
    }
  }, [open]);

  // Si se abre con un ID inicial a editar
  useEffect(() => {
    if (open && initialEditRecipeId) {
      const rec = recetas.find((r) => String(r.id) === String(initialEditRecipeId));
      if (rec) {
        handleEdit(rec);
      } else {
        handleAdd();
      }
    } else if (open && !initialEditRecipeId) {
      setEditingRecipe(null);
    }
  }, [open, initialEditRecipeId, recetas]);

  const handleAdd = () => {
    setEditingRecipe({
      id: null,
      nombre: '',
      ingredientes: []
    });
  };

  const handleEdit = (receta) => {
    setEditingRecipe({
      id: receta.id,
      nombre: receta.nombre || '',
      ingredientes: (receta.ingredientes || []).map((i) => ({
        insumo_id: String(i.insumo_id),
        cantidad: String(i.cantidad)
      }))
    });
  };

  const handleAddIngredient = () => {
    if (!editingRecipe) return;
    const primerInsumo = insumos[0];
    setEditingRecipe({
      ...editingRecipe,
      ingredientes: [
        ...editingRecipe.ingredientes,
        { insumo_id: primerInsumo ? String(primerInsumo.id) : '', cantidad: '1' }
      ]
    });
  };

  const handleUpdateIngredient = (index, field, value) => {
    if (!editingRecipe) return;
    const newIngredients = [...editingRecipe.ingredientes];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setEditingRecipe({ ...editingRecipe, ingredientes: newIngredients });
  };

  const handleRemoveIngredient = (index) => {
    if (!editingRecipe) return;
    const newIngredients = [...editingRecipe.ingredientes];
    newIngredients.splice(index, 1);
    setEditingRecipe({ ...editingRecipe, ingredientes: newIngredients });
  };

  const handleSaveRecipe = async () => {
    if (!editingRecipe) return;

    if (!editingRecipe.nombre.trim()) {
      toast.error('El nombre de la receta es obligatorio');
      return;
    }

    if (editingRecipe.ingredientes.length === 0) {
      toast.error('Debe agregar al menos un ingrediente de inventario');
      return;
    }

    for (const ing of editingRecipe.ingredientes) {
      if (!ing.insumo_id) {
        toast.error('Todos los ingredientes deben tener un insumo seleccionado');
        return;
      }
      const cant = parseFloat(ing.cantidad);
      if (isNaN(cant) || cant <= 0) {
        toast.error('La cantidad de cada ingrediente debe ser mayor a 0');
        return;
      }
    }

    const payload = {
      nombre: editingRecipe.nombre.trim(),
      ingredientes: editingRecipe.ingredientes.map((i) => ({
        insumo_id: Number(i.insumo_id),
        cantidad: Number(i.cantidad)
      }))
    };

    try {
      setGuardando(true);
      if (editingRecipe.id) {
        await productoService.actualizarRecetaIndependiente(editingRecipe.id, payload);
        toast.success(`Receta "${payload.nombre}" actualizada`);
      } else {
        await productoService.crearReceta(payload);
        toast.success(`Receta "${payload.nombre}" creada con éxito`);
      }
      setEditingRecipe(null);
      if (onRecetaGuardada) onRecetaGuardada();
    } catch (error) {
      toast.error(error.message || 'Error al guardar la receta');
    } finally {
      setGuardando(false);
    }
  };

  const handleDeleteRecipe = async (receta) => {
    try {
      setGuardando(true);
      await productoService.eliminarRecetaIndependiente(receta.id);
      toast.success(`Receta "${receta.nombre}" eliminada`);
      if (onRecetaGuardada) onRecetaGuardada();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar la receta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="bg-white rounded-xl shadow-xl max-w-3xl sm:max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] p-0 border border-gray-100">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Recetas
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {cargando ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#4B2B1D] mb-2" />
              <p className="text-sm">Cargando receta...</p>
            </div>
          ) : editingRecipe ? (
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Receta
                </Label>
                <Input
                  type="text"
                  value={editingRecipe.nombre}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#A67C52] text-sm bg-white"
                  placeholder="Ej. Receta de Gin Tonic..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 mt-4">
                  <Label className="block text-sm font-medium text-gray-700">
                    Ingredientes de Inventario
                  </Label>
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="flex items-center gap-1 text-sm text-[#9F4F2F] font-medium hover:text-[#9F4F2F]/80 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Agregar Ingrediente
                  </button>
                </div>

                <div className="space-y-2">
                  {editingRecipe.ingredientes.length === 0 && (
                    <p className="text-sm text-gray-500 italic py-2">
                      No hay ingredientes agregados.
                    </p>
                  )}
                  {editingRecipe.ingredientes.map((ing, index) => (
                    <div
                      key={index}
                      className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100"
                    >
                      <select
                        value={ing.insumo_id}
                        onChange={(e) => handleUpdateIngredient(index, 'insumo_id', e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#A67C52] bg-white h-9"
                      >
                        <option value="" disabled>Seleccione ingrediente</option>
                        {insumos.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.nombre} ({inv.unidad_medida})
                          </option>
                        ))}
                      </select>

                      <div className="w-32 relative">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={ing.cantidad}
                          onChange={(e) => handleUpdateIngredient(index, 'cantidad', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus-visible:ring-2 focus-visible:ring-[#A67C52] bg-white h-9"
                          placeholder="Cant."
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveIngredient(index)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRecipe(null)}
                  disabled={guardando}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={guardando}
                  className="px-4 py-2 bg-[#4B2B1D] text-white rounded-lg hover:bg-[#9F4F2F] transition-colors"
                >
                  {guardando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Guardar Receta
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-gray-900">
                  Lista de Recetas
                </h2>
                <Button
                  type="button"
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4B2B1D] text-white rounded-lg hover:bg-[#9F4F2F] transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Agregar Nueva Receta
                </Button>
              </div>

              <div className="space-y-2">
                {recetas.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">
                    No hay recetas registradas.
                  </p>
                ) : (
                  recetas.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-900">{recipe.nombre}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {recipe.ingredientes?.length || 0} {recipe.ingredientes?.length === 1 ? 'ingrediente' : 'ingredientes'}
                          {recipe.costo_total !== undefined && ` • Costo: ${formatearPrecio(recipe.costo_total)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(recipe)}
                          className="p-1.5 text-gray-500 hover:text-[#4B2B1D] transition-colors cursor-pointer"
                          title="Editar receta"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecipe(recipe)}
                          className="p-1.5 text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                          title="Eliminar receta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
