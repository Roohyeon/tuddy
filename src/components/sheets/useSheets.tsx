'use client';
/* 화면 어디서든 시트를 여는 액션 모음 */
import { useMemo } from 'react';
import { pickFile } from '@/lib/files';
import { useSheetStore } from '@/stores/sheet';
// 시트는 지연 로딩해요 (lazy.tsx) — 이 훅을 쓰는 화면의 초기 JS에 시트 코드가 들어가지 않아요
import {
  AlertsSheet, BookSheet, BudgetSheet, CaptureSheet, DatesSheet, DdaySheet, ExpenseSheet, FlightSheet, MapSheet,
  PackSheet, PassImageSheet, RenameDaySheet, SchedSheet, TripsSheet, VoucherSaveSheet, VoucherViewSheet,
} from './lazy';

export function useSheets() {
  const openSheet = useSheetStore(s => s.openSheet), closeSheet = useSheetStore(s => s.closeSheet);
  return useMemo(() => ({
    addSchedule: (day: number) => openSheet(<SchedSheet day={day} />),
    editSchedule: (id: string) => openSheet(<SchedSheet key={id} id={id} />),
    renameDay: (i: number) => openSheet(<RenameDaySheet i={i} />),
    mapDay: (day: number) => openSheet(<MapSheet day={day} />),
    editDates: () => openSheet(<DatesSheet />),
    addExpense: () => openSheet(<ExpenseSheet />),
    editExpense: (id: string) => openSheet(<ExpenseSheet key={id} id={id} />),
    scanReceipt: () => pickFile('image/*', file => openSheet(<ExpenseSheet key={file.name + file.size} scan={file} />)),
    budgetSettings: () => openSheet(<BudgetSheet />),
    addPack: () => openSheet(<PackSheet />),
    addDday: () => openSheet(<DdaySheet />),
    capture: () => { closeSheet(); pickFile('image/*', file => openSheet(<CaptureSheet key={file.name + file.size} file={file} />)); },
    editFlight: () => openSheet(<FlightSheet />),
    passImage: () => openSheet(<PassImageSheet />),
    scanVoucher: () => pickFile('image/*,application/pdf', file => openSheet(<VoucherSaveSheet key={file.name + file.size} file={file} />)),
    viewVoucher: (id: string) => openSheet(<VoucherViewSheet id={id} />),
    book: () => openSheet(<BookSheet />),
    trips: () => openSheet(<TripsSheet />),
    alerts: () => openSheet(<AlertsSheet />),
  }), [openSheet, closeSheet]);
}
