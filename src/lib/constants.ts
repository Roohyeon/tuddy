import type { Companion, ExpenseCat, PackCat, StopType, TabKey, VaultType } from '@/types/domain';
import type { IconName } from '@/components/ui/Icon';

export const EXCAT: Record<ExpenseCat, { label: string; color: string; icon: IconName }> = {
  flight: { label: '항공', color: '#2f4156', icon: 'plane' },
  stay: { label: '숙소', color: '#567c8d', icon: 'bed' },
  move: { label: '교통', color: '#93afc2', icon: 'train' },
  ins: { label: '보험 · 통신', color: '#cfdde8', icon: 'shield' },
  food: { label: '식비', color: '#c4896c', icon: 'food' },
  shop: { label: '쇼핑', color: '#dcc6b8', icon: 'shop' },
  sight: { label: '관광', color: '#7b9cab', icon: 'pin' },
  etc: { label: '기타', color: '#b9c3cc', icon: 'receipt' },
};

export const STYPE: Record<StopType, { label: string; icon: IconName }> = {
  move: { label: '이동', icon: 'train' }, stay: { label: '숙소', icon: 'bed' }, sight: { label: '관광', icon: 'pin' },
  food: { label: '식당', icon: 'food' }, shop: { label: '쇼핑', icon: 'shop' }, rest: { label: '휴식', icon: 'coffee' },
};

export const PACK_CATS: PackCat[] = ['서류', '전자기기', '의류', '세면 · 의약품', '기타'];
const PACK_KW: Partial<Record<PackCat, string[]>> = {
  '서류': ['여권', '비자', '보험', '티켓', '바우처', '증', '서류', '면허', '예약', '등록'],
  '전자기기': ['충전', '배터리', '어댑터', '케이블', '카메라', 'esim', '유심', '이어폰', '노트북', '폰', '태블릿', '드라이기'],
  '의류': ['옷', '상의', '하의', '양말', '속옷', '모자', '신발', '운동화', '잠옷', '겉옷', '자켓', '코트', '수영복', '슬리퍼', '바지', '셔츠'],
  '세면 · 의약품': ['약', '칫솔', '치약', '세면', '선크림', '렌즈', '안경', '마스크', '화장', '샴푸', '로션', '밴드'],
};
export const guessCat = (s: string): PackCat => {
  const q = s.toLowerCase();
  for (const [c, ws] of Object.entries(PACK_KW)) if (ws.some(w => q.includes(w))) return c as PackCat;
  return '기타';
};

export const VKIND: Record<VaultType, string> = { ticket: 'e-티켓', stay: '숙소 바우처', move: '교통 바우처', entry: '입장권', receipt: '영수증', etc: '기타' };
export const COMPS: Companion[] = ['혼자', '가족', '친구', '연인'];
export const AIRLINES = ['KE', 'OZ', '7C', 'LJ', 'TW', 'ZE'];
export const PAY_METHODS = ['카드', '현금', '트래블카드'];

export const TABS: [TabKey, string, IconName][] = [
  ['home', '홈', 'home'], ['schedule', '일정', 'cal'], ['budget', '가계부', 'wallet'], ['packing', '체크리스트', 'list'], ['vault', '보관함', 'folder'],
];

export const DEMO_EMAIL = 'demo@tuddy.app';
