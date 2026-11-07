import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '@/components/ui/table';
import { X, Edit, Trash2 } from 'lucide-react';

export default function ProductosModalEditarEliminar({
  open,
  onOpenChange,
  productos = [],
  onEditProduct,
  onDeleteProduct
}) {
  const [deletingProduct, setDeletingProduct] = useState(null);

  const handleConfirmDelete = (motivo) => {
    if (deletingProduct && onDeleteProduct) {
      onDeleteProduct(deletingProduct, motivo);
    }
    setDeletingProduct(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] p-0 border border-gray-100">
          <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-gray-100">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Editar Productos
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
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <Table className="w-full text-left text-sm text-gray-600">
                <TableHeader className="bg-gray-50 border-b border-gray-200 text-gray-700">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 font-medium text-gray-700">Producto</TableHead>
                    <TableHead className="px-4 py-3 font-medium text-gray-700">Categoría</TableHead>
                    <TableHead className="px-4 py-3 font-medium text-gray-700">Precio</TableHead>
                    <TableHead className="px-4 py-3 font-medium text-right text-gray-700">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100">
                  {productos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        No hay productos registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    productos.map((product) => (
                      <TableRow key={product.id} className="hover:bg-gray-50/50">
                        <TableCell className="px-4 py-3 font-medium text-gray-900">
                          {product.nombre}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="inline-block px-2 py-1 bg-[#F3E5DC] text-[#4B2B1D] text-xs font-semibold rounded-full">
                            {product.categoria_nombre || 'Sin Categoría'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-gray-900 font-medium">
                          ${Number(product.precio_venta || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onOpenChange(false);
                                onEditProduct(product);
                              }}
                              className="p-1.5 text-gray-500 hover:text-[#4B2B1D] bg-white border border-gray-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                              title="Editar producto"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(product)}
                              className="p-1.5 text-gray-500 hover:text-red-600 bg-white border border-gray-200 rounded-md shadow-2xs transition-colors cursor-pointer"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Motivo de Eliminación (Fiel a Cafeteria_1) */}
      <Dialog open={Boolean(deletingProduct)} onOpenChange={(val) => !val && setDeletingProduct(null)}>
        <DialogContent className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100 p-0">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg font-bold text-gray-900">Motivo de eliminación</h3>
            <button
              type="button"
              onClick={() => setDeletingProduct(null)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Seleccione la razón por la que elimina este producto:
            </p>

            <button
              type="button"
              onClick={() => handleConfirmDelete('Producto Vencido')}
              className="w-full py-3 px-4 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-sm font-bold transition-colors border border-orange-200 cursor-pointer text-center"
            >
              Producto Vencido
            </button>

            <button
              type="button"
              onClick={() => handleConfirmDelete('Merma')}
              className="w-full py-3 px-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-bold transition-colors border border-red-200 cursor-pointer text-center"
            >
              Merma
            </button>

            <button
              type="button"
              onClick={() => handleConfirmDelete('En Falta')}
              className="w-full py-3 px-4 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors border border-gray-200 cursor-pointer text-center"
            >
              En Falta
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
