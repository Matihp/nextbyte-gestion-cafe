import React from 'react';
import { X, Utensils } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function RecipeDetailModal({ open, onOpenChange, recipe, onClose }) {
  if (!recipe) return null;

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const ingredients = recipe.ingredients || recipe.ingredientes || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-0 gap-0 border-0">
        <DialogHeader className="px-6 py-5 border-b border-gray-100 flex flex-row justify-between items-center bg-gray-50 space-y-0">
          <DialogTitle className="text-xl font-bold text-[#4B2B1D]">
            Receta: {recipe.name || recipe.nombre || 'Producto'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-h-[60vh]">
          {ingredients.length === 0 ? (
            <div className="py-8 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
              <Utensils className="w-8 h-8 text-gray-300" />
              <p className="text-sm">Esta receta no tiene ingredientes detallados.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ingredients.map((ing, idx) => {
                const nombreInsumo =
                  ing.nombre ||
                  ing.insumo_nombre ||
                  ing.insumo?.nombre ||
                  ing.name ||
                  `Insumo #${ing.insumo_id || ing.inventoryId || idx + 1}`;
                const cantidad = ing.cantidad || ing.quantity || 0;
                const unidad = ing.unidad_medida || ing.unidad || ing.unit || '';

                return (
                  <div key={idx} className="flex justify-between items-center py-2.5">
                    <span className="font-medium text-gray-800 text-sm">
                      {nombreInsumo}
                    </span>
                    <span className="text-gray-600 text-sm font-semibold">
                      {cantidad} {unidad}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <Button
            type="button"
            onClick={handleClose}
            className="w-full py-3 bg-[#4B2B1D] text-white rounded-xl font-bold hover:bg-[#3a2216] transition-colors cursor-pointer h-12"
          >
            Cerrar Receta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RecipeDetailModal;

