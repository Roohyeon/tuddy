/* =========================================================
   Supabase 테이블 타입 — supabase/migrations의 스키마와 같아요.
   스키마를 바꾸면 `npx supabase gen types typescript --linked`로 다시 만들 수 있어요.
   ========================================================= */
import type { Flight, Leg, NotifySettings, VaultFile } from '@/types/domain';

type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

/** Row에서 기본값이 있는 열은 Insert에서 생략할 수 있어요 */
type Table<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = { user_id: string; name: string; is_demo: boolean; active_trip_id: string | null; created_at: string }

export type TripRow = {
  id: string; user_id: string; dest: string; start_date: string; end_date: string;
  companion: string; people: number; budget: number; rate: number; rate_mode: string; template: string;
  titles: string[]; flight: Flight & Json; notify: NotifySettings & Json; created_at: string;
}

export type ScheduleRow = {
  id: string; user_id: string; trip_id: string; day: number; time: string; title: string; place: string;
  type: string; area: string; meta: string; memo: string; cost: number; status: string; dur: number;
  lat: number | null; lng: number | null; leg: (Leg & Json) | null; day_was: number | null;
}

export type ExpenseRow = {
  id: string; user_id: string; trip_id: string; title: string; cat: string; krw: number; amt: number;
  cur: string; date: string; pay: string; receipt: boolean;
}

export type PackingRow = { id: string; user_id: string; trip_id: string; cat: string; text: string; sub: string; done: boolean }

export type DdayRow = {
  id: string; user_id: string; trip_id: string; text: string; sub: string | null; tag: string | null;
  auto: string | null; done: boolean;
}

export type VaultRow = {
  id: string; user_id: string; trip_id: string; type: string; title: string; sub: string; date: string;
  file: (VaultFile & Json) | null; link_id: string | null; expense_id: string | null;
}

/** 여행지 카탈로그 (어드민 관리) — updated_at · updated_by는 서버 트리거가 채워요 */
export type DestinationRow = {
  key: string; city: string; city_en: string; country_code: string; airport_code: string; airport_name: string;
  flight_min: number; lat: number; lng: number; hot: boolean; description: string; image_url: string | null;
  rating: number | null; updated_at: string; updated_by: string | null;
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'name' | 'is_demo' | 'active_trip_id' | 'created_at'>;
      trips: Table<TripRow, 'user_id' | 'created_at'>;
      schedule_items: Table<ScheduleRow, 'user_id'>;
      expenses: Table<ExpenseRow, 'user_id'>;
      packing_items: Table<PackingRow, 'user_id'>;
      dday_items: Table<DdayRow, 'user_id'>;
      vault_items: Table<VaultRow, 'user_id'>;
      destinations: Table<DestinationRow, 'hot' | 'description' | 'image_url' | 'rating' | 'updated_at' | 'updated_by'>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type ChildTable = 'schedule_items' | 'expenses' | 'packing_items' | 'dday_items' | 'vault_items';
