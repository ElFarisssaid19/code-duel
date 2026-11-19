import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Accessible modal dialog (focus moves in, Escape / backdrop click closes when onClose is set). */
export default function Modal({ open, title, children, onClose, tone = 'default' }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panelRef.current?.querySelector('button, [href], input')?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape' && onClose) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const border = {
    default: 'border-zinc-800',
    success: 'border-emerald-500/40',
    danger: 'border-red-500/40',
  }[tone];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full max-w-md rounded-2xl border bg-zinc-900 p-6 shadow-2xl shadow-black/50 ${border}`}
      >
        <h2 id={titleId} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
