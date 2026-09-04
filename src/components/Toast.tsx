import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

const config: Record<ToastType, { icon: typeof CheckCircle2; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  error: { icon: XCircle, classes: 'bg-red-50 border-red-200 text-red-800' },
  info: { icon: Info, classes: 'bg-blue-50 border-blue-200 text-blue-800' },
  warning: { icon: AlertCircle, classes: 'bg-amber-50 border-amber-200 text-amber-800' },
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const { icon: Icon, classes } = config[toast.type];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ring-1 ring-black/5 ${classes}`}
      role="alert"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
