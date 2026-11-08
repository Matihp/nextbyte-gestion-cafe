import { createPortal } from 'react-dom';

export function PrintPortal({ children, id = 'print-area', className = '', pageType = 'a4' }) {
  if (typeof document === 'undefined') return null;

  const isTicket = pageType === 'ticket' || className.includes('ticket-termico');

  return createPortal(
    <div id={id} className={`hidden print:block bg-white text-black font-sans m-0 p-0 text-left ${className}`}>
      <style>{`
        @page {
          size: ${isTicket ? 'auto' : 'A4 portrait'};
          margin: ${isTicket ? '3mm 4mm' : '8mm 10mm'};
        }
      `}</style>
      {children}
    </div>,
    document.body
  );
}

export default PrintPortal;
