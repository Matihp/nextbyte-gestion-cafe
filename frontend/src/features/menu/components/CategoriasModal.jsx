import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import productoService from '@/services/productoService';
import { AVAILABLE_EMOJIS, getCategoryDetails } from '../utils/categoriasHelper';
import { toast } from 'sonner';
import { X, Plus, Edit, Trash2, AlertTriangle, Loader2 } from 'lucide-react';

export default function CategoriasModal({
  open,
  onOpenChange,
  categorias = [],
  productos = [],
  onActualizarCategorias
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📦');

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📦');

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showWarning, setShowWarning] = useState(null); // id de categoría en advertencia
  const [guardando, setGuardando] = useState(false);

  const handleAdd = () => {
    setIsAddingNew(true);
    setNewName('');
    setNewIcon('📦');
    setEditingId(null);
    setShowEmojiPicker(false);
  };

  const handleSaveNew = async () => {
    const nombreLimpio = newName.trim();
    if (!nombreLimpio) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    try {
      setGuardando(true);
      await productoService.crearCategoria({
        nombre: nombreLimpio,
        icono: newIcon
      });
      toast.success(`Categoría "${nombreLimpio}" agregada`);
      setIsAddingNew(false);
      setNewName('');
      setShowEmojiPicker(false);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al crear la categoría');
    } finally {
      setGuardando(false);
    }
  };

  const handleSaveEdit = async (catId) => {
    const nombreLimpio = editName.trim();
    if (!nombreLimpio) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    try {
      setGuardando(true);
      await productoService.actualizarCategoria(catId, {
        nombre: nombreLimpio,
        icono: editIcon
      });
      toast.success('Categoría actualizada');
      setEditingId(null);
      setShowEmojiPicker(false);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al actualizar la categoría');
    } finally {
      setGuardando(false);
    }
  };

  const handleDeleteRequest = (catId) => {
    const hasProducts = productos.some((p) => Number(p.categoria_id) === Number(catId));
    if (hasProducts) {
      setShowWarning(catId);
    } else {
      procederEliminar(catId);
    }
  };

  const procederEliminar = async (catId) => {
    try {
      setGuardando(true);
      await productoService.eliminarCategoria(catId);
      toast.success('Categoría eliminada');
      setShowWarning(null);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar la categoría');
    } finally {
      setGuardando(false);
    }
  };

  const confirmDeleteWithProducts = async () => {
    if (!showWarning) return;
    try {
      setGuardando(true);
      // Eliminar primero los productos asignados a la categoría
      const prodsAEliminar = productos.filter((p) => Number(p.categoria_id) === Number(showWarning));
      for (const p of prodsAEliminar) {
        await productoService.eliminarProducto(p.id, 'Merma');
      }
      await productoService.eliminarCategoria(showWarning);
      toast.success('Categoría y sus productos eliminados');
      setShowWarning(null);
      if (onActualizarCategorias) onActualizarCategorias();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar la categoría y productos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="bg-white rounded-xl shadow-xl max-w-md sm:max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] p-0 border border-gray-100">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Categorías
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
          {showWarning && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-red-800 mb-1">
                    ¡Atención! Categoría en uso
                  </h3>
                  <p className="text-xs text-red-700 mb-3 leading-relaxed">
                    Esta categoría tiene productos ingresados. Si se elimina, se eliminarán todos sus productos. Puede editar su nombre y los productos seguirán estando disponibles, pero si la elimina, desaparecerán definitivamente.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmDeleteWithProducts}
                      disabled={guardando}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 cursor-pointer disabled:opacity-50"
                    >
                      {guardando ? 'Eliminando...' : 'Eliminar definitivamente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWarning(null)}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {categorias.map((cat) => {
              const emojiDisplay = cat.icono || getCategoryDetails(cat.nombre).emoji;
              const isEditingThis = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  {isEditingThis ? (
                    <div className="flex-1 flex gap-2 relative items-center">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="w-9 h-9 flex items-center justify-center bg-white border border-gray-300 rounded-md text-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          {editIcon}
                        </button>
                        {showEmojiPicker && (
                          <div className="absolute top-10 left-0 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-2 z-20 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                            {AVAILABLE_EMOJIS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => {
                                  setEditIcon(e);
                                  setShowEmojiPicker(false);
                                }}
                                className="p-1 hover:bg-gray-100 rounded text-xl cursor-pointer"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus-visible:ring-2 focus-visible:ring-[#A67C52] bg-white h-9"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        disabled={guardando}
                        className="px-3 py-1.5 bg-[#4B2B1D] text-white text-sm rounded-md hover:bg-[#9F4F2F] cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-xl leading-none select-none">{emojiDisplay}</span>
                        <span className="font-medium text-gray-800">{cat.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditName(cat.nombre);
                            setEditIcon(cat.icono || getCategoryDetails(cat.nombre).emoji);
                            setIsAddingNew(false);
                            setShowEmojiPicker(false);
                          }}
                          className="p-1.5 text-gray-500 hover:text-[#4B2B1D] transition-colors cursor-pointer"
                          title="Editar categoría"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(cat.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {isAddingNew && (
              <div className="flex gap-2 p-3 bg-[#F3E5DC] rounded-lg border border-amber-100 relative items-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-9 h-9 flex items-center justify-center bg-white border border-gray-300 rounded-md text-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {newIcon}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-10 left-0 w-64 bg-white border border-gray-200 shadow-xl rounded-lg p-2 z-20 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
                      {AVAILABLE_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setNewIcon(e);
                            setShowEmojiPicker(false);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-xl cursor-pointer"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de categoría..."
                  className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-md focus-visible:ring-2 focus-visible:ring-[#A67C52] bg-white h-9"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveNew}
                  disabled={guardando}
                  className="px-3 py-1.5 bg-[#4B2B1D] text-white text-sm rounded-md hover:bg-[#9F4F2F] cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 px-4 py-2.5 bg-gray-200 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium shadow-2xs h-10"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isAddingNew || Boolean(editingId)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4B2B1D] text-white rounded-lg hover:bg-[#9F4F2F] disabled:opacity-50 transition-colors font-medium shadow-2xs h-10 cursor-pointer"
          >
            <Plus className="w-5 h-5" /> Agregar Categoría
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
