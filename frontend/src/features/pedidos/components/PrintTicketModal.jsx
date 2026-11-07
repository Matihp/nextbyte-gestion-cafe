import { Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatearIdPedido } from '@/utils/formatters';

export function PrintTicketModal({ order, open, onConfirmPrint, onCancel }) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-sm p-0 rounded-2xl bg-white overflow-hidden shadow-2xl border border-border/20 text-center"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Printer className="w-8 h-8" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900 mb-2">
            Comanda enviada con éxito
          </DialogTitle>
          <p className="text-secondary font-bold text-lg mb-4">
            ID: {formatearIdPedido(order)}
          </p>
          <DialogDescription className="text-gray-600 text-sm">
            ¿Desea imprimir el comprobante del pedido?
          </DialogDescription>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 py-3 h-auto bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirmPrint}
            className="flex-1 py-3 h-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold transition-colors shadow-sm"
          >
            IMPRIMIR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrintTicketModal;
