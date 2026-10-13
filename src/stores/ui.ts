/* 화면 간에 이어지는 UI 선택 값 — 서버에 저장하지 않아요 */
import { create } from 'zustand';
import type { CheckKind, PassDir } from '@/types/domain';

interface UIStore {
  /** 홈 동선 카드의 일차 */
  day: number;
  /** 일정 화면의 일차 */
  sday: number;
  /** 체크리스트 탭 */
  ctab: CheckKind;
  /** 탑승권 방향 */
  passDir: PassDir;
  /** 앱 안에서 한 번이라도 이동했는지 (뒤로 가기 판단) */
  navigated: boolean;
  setUI: (patch: Partial<Omit<UIStore, 'setUI' | 'resetDays'>>) => void;
  /** 여행이 바뀌면 일차 선택을 처음으로 */
  resetDays: () => void;
}

export const useUIStore = create<UIStore>()(set => ({
  day: 0, sday: 0, ctab: 'pack', passDir: 'out', navigated: false,
  setUI: patch => set(patch),
  resetDays: () => set({ day: 0, sday: 0 }),
}));
