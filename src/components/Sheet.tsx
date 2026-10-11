import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { copy } from '@/copy';

/** Modal bottom sheet on a native <dialog>: showModal() gives the focus trap, Esc and inert background. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto mb-0 w-full max-w-lg rounded-t-sheet bg-surface p-0 text-ink backdrop:bg-black/40 sm:mb-auto sm:rounded-sheet"
    >
      {open && (
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              type="button"
              aria-label={copy.common.close}
              onClick={onClose}
              className="grid size-11 place-items-center rounded-full hover:bg-bg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  );
}
