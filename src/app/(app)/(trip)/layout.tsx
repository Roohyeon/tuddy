import type { ReactNode } from 'react';
import { Guard } from '@/components/ui/Guards';

/** 여행이 있어야 들어올 수 있는 화면들 */
export default function TripLayout({ children }: { children: ReactNode }) {
  return <Guard need="trip">{children}</Guard>;
}
