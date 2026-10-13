/* 토스트 알림 */
import { create } from 'zustand';

interface ToastAction { label: string; fn: () => void }
interface ToastState { id: number; msg: string; action?: ToastAction }

interface ToastStore {
  current: ToastState | null;
  toast: (msg: string, action?: ToastAction) => void;
  dismiss: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastStore>()(set => ({
  current: null,
  toast: (msg, action) => {
    clearTimeout(timer);
    set({ current: { id: Date.now(), msg, action } });
    timer = setTimeout(() => set({ current: null }), action ? 4500 : 2600);
  },
  dismiss: () => { clearTimeout(timer); set({ current: null }); },
}));

/** 컴포넌트에서 토스트 띄우기 */
export const useToast = () => useToastStore(s => s.toast);
