'use client';
/* =========================================================
   시트 지연 로딩 — 시트는 버튼을 눌러야 열리니 화면의 초기 JS에서 빼요
   - 파일 단위로 청크가 나뉘어요 (같은 파일의 시트는 한 청크)
   - 앱이 뜨고 브라우저가 한가해지면 prefetchSheets()로 미리 받아 첫 클릭 지연을 없애요
   ========================================================= */
import dynamic from 'next/dynamic';

// next/dynamic은 빌드할 때 분석돼요 → import()와 옵션을 호출마다 리터럴로 직접 써야 해요
const SheetLoading = () => <div className="sheet-loading" aria-busy="true" aria-label="불러오는 중"><span className="spinner" /></div>;

export const TripsSheet = dynamic(() => import('./AccountSheets').then(m => m.TripsSheet), { ssr: false, loading: SheetLoading });
export const TripEditSheet = dynamic(() => import('./AccountSheets').then(m => m.TripEditSheet), { ssr: false, loading: SheetLoading });
export const AlertsSheet = dynamic(() => import('./AccountSheets').then(m => m.AlertsSheet), { ssr: false, loading: SheetLoading });
export const ExpenseSheet = dynamic(() => import('./BudgetSheets').then(m => m.ExpenseSheet), { ssr: false, loading: SheetLoading });
export const BudgetSheet = dynamic(() => import('./BudgetSheets').then(m => m.BudgetSheet), { ssr: false, loading: SheetLoading });
export const PackSheet = dynamic(() => import('./ChecklistSheets').then(m => m.PackSheet), { ssr: false, loading: SheetLoading });
export const DdaySheet = dynamic(() => import('./ChecklistSheets').then(m => m.DdaySheet), { ssr: false, loading: SheetLoading });
export const CaptureSheet = dynamic(() => import('./PassSheets').then(m => m.CaptureSheet), { ssr: false, loading: SheetLoading });
export const FlightSheet = dynamic(() => import('./PassSheets').then(m => m.FlightSheet), { ssr: false, loading: SheetLoading });
export const PassImageSheet = dynamic(() => import('./PassSheets').then(m => m.PassImageSheet), { ssr: false, loading: SheetLoading });
export const SchedSheet = dynamic(() => import('./ScheduleSheets').then(m => m.SchedSheet), { ssr: false, loading: SheetLoading });
export const RenameDaySheet = dynamic(() => import('./ScheduleSheets').then(m => m.RenameDaySheet), { ssr: false, loading: SheetLoading });
export const PlanSheet = dynamic(() => import('./ScheduleSheets').then(m => m.PlanSheet), { ssr: false, loading: SheetLoading });
export const MapSheet = dynamic(() => import('./ScheduleSheets').then(m => m.MapSheet), { ssr: false, loading: SheetLoading });
export const DatesSheet = dynamic(() => import('./ScheduleSheets').then(m => m.DatesSheet), { ssr: false, loading: SheetLoading });
export const VoucherSaveSheet = dynamic(() => import('./VaultSheets').then(m => m.VoucherSaveSheet), { ssr: false, loading: SheetLoading });
export const VoucherViewSheet = dynamic(() => import('./VaultSheets').then(m => m.VoucherViewSheet), { ssr: false, loading: SheetLoading });
export const BookSheet = dynamic(() => import('./VaultSheets').then(m => m.BookSheet), { ssr: false, loading: SheetLoading });

/** 첫 화면이 다 그려진 뒤 한가할 때 시트 청크를 미리 받아 둬요 (실패해도 열 때 다시 받아요) */
export function prefetchSheets() {
  for (const load of [
    () => import('./AccountSheets'), () => import('./BudgetSheets'), () => import('./ChecklistSheets'),
    () => import('./PassSheets'), () => import('./ScheduleSheets'), () => import('./VaultSheets'),
  ]) load().catch(() => {});
}
