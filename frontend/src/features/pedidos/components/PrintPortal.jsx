import { createPortal } from 'react-dom';

export function PrintPortal({ children, id = 'print-area' }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div id={id} className="hidden print:block bg-white text-black font-sans w-full max-w-sm mx-auto p-4">
      {children}
    </div>,
    document.body
  );
}

export default PrintPortal;

