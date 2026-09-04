import { useCallback, useState } from 'react';
import type { ToastMessage } from '@/components/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const showToast = {
    success: (msg: string) => toast('success', msg),
    error: (msg: string) => toast('error', msg),
    info: (msg: string) => toast('info', msg),
    warning: (msg: string) => toast('warning', msg),
  };

  return { toasts, dismiss, showToast };
}
