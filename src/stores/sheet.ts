/* 바텀 시트 열림 · 닫힘 */
import type { ReactNode } from 'react';
import { create } from 'zustand';

interface SheetStore {
  sheet: ReactNode;
  openSheet: (node: ReactNode) => void;
  closeSheet: () => void;
}

export const useSheetStore = create<SheetStore>()(set => ({
  sheet: null,
  openSheet: sheet => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
}));
