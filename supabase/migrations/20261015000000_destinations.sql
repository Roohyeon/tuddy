-- =========================================================
-- 여행지 카탈로그 (어드민 관리)
-- 누구나 읽고, 관리자(app_metadata.role = 'admin')만 추가 · 수정 · 삭제해요.
-- 관리자 지정: 대시보드 SQL Editor에서 (role은 사용자가 바꿀 수 없는 app_metadata에 둬요)
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '관리자@메일';
--   → 그 계정으로 다시 로그인해야 토큰(JWT)에 role이 들어가요.
-- 화면(zod)과 같은 규칙을 DB 제약으로도 걸어서, API를 직접 불러도 잘못된 값은 들어오지 않아요.
-- =========================================================

create table public.destinations (
  key          text primary key check (key ~ '^[a-z][a-z0-9-]{1,39}$'),
  city         text not null check (char_length(city) between 1 and 20),
  city_en      text not null check (city_en ~ '^[A-Za-z][A-Za-z .''-]{0,39}$'),
  -- 나라는 통화 · 콘센트 · 입국 허가 정보가 붙은 37개 코드 중에서 골라요 (src/lib/destinations.ts의 COUNTRIES)
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  airport_code text not null check (airport_code ~ '^[A-Z]{3}$'),
  airport_name text not null check (char_length(airport_name) between 1 and 20),
  flight_min   integer not null check (flight_min between 30 and 1500),
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  hot          boolean not null default false,
  description  text not null default '' check (char_length(description) <= 300),
  image_url    text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 500)),
  rating       numeric(2, 1) check (rating is null or (rating between 0 and 5 and rating * 2 = round(rating * 2))),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid() references auth.users (id) on delete set null,
  -- 국내선은 2시간을 넘지 않아요 (화면 검증과 같은 규칙)
  check (country_code <> 'KR' or flight_min <= 120)
);

-- 수정할 때마다 시각 · 수정자를 서버가 채워요 (클라이언트 값을 믿지 않아요)
create or replace function public.touch_destination() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger destinations_touch
  before insert or update on public.destinations
  for each row execute function public.touch_destination();

-- ---------- RLS ----------
create or replace function public.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

alter table public.destinations enable row level security;

create policy "destinations: 누구나 조회" on public.destinations
  for select to anon, authenticated using (true);
create policy "destinations: 관리자 추가" on public.destinations
  for insert to authenticated with check ((select public.is_admin()));
create policy "destinations: 관리자 수정" on public.destinations
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "destinations: 관리자 삭제" on public.destinations
  for delete to authenticated using ((select public.is_admin()));

-- ---------- 초기 데이터 ----------
-- 기존 앱 데이터(src/lib/destinations.ts의 CITIES 80곳)를 그대로 옮겨요. 설명 · 이미지 · 평점은 어드민에서 채워요.
insert into public.destinations (key, city, city_en, country_code, airport_code, airport_name, flight_min, lat, lng, hot) values
  ('jeju', '제주', 'Jeju', 'KR', 'CJU', '제주', 70, 33.4996, 126.5312, false),
  ('busan', '부산', 'Busan', 'KR', 'PUS', '부산 · 김해', 60, 35.1796, 129.0756, false),
  ('tokyo', '도쿄', 'Tokyo', 'JP', 'NRT', '도쿄 · 나리타', 140, 35.6812, 139.7671, false),
  ('osaka', '오사카', 'Osaka', 'JP', 'KIX', '오사카 · 간사이', 105, 34.6937, 135.5023, false),
  ('kyoto', '교토', 'Kyoto', 'JP', 'KIX', '오사카 · 간사이', 105, 35.0116, 135.7681, false),
  ('fukuoka', '후쿠오카', 'Fukuoka', 'JP', 'FUK', '후쿠오카', 80, 33.5902, 130.4017, false),
  ('sapporo', '삿포로', 'Sapporo', 'JP', 'CTS', '삿포로 · 신치토세', 165, 43.0618, 141.3545, false),
  ('okinawa', '오키나와', 'Okinawa', 'JP', 'OKA', '오키나와 · 나하', 135, 26.2124, 127.6809, true),
  ('nagoya', '나고야', 'Nagoya', 'JP', 'NGO', '나고야 · 주부', 115, 35.1815, 136.9066, false),
  ('matsuyama', '마쓰야마', 'Matsuyama', 'JP', 'MYJ', '마쓰야마', 90, 33.8392, 132.7657, false),
  ('beijing', '베이징', 'Beijing', 'CN', 'PEK', '베이징 · 서우두', 125, 39.9042, 116.4074, false),
  ('shanghai', '상하이', 'Shanghai', 'CN', 'PVG', '상하이 · 푸둥', 115, 31.2304, 121.4737, false),
  ('qingdao', '칭다오', 'Qingdao', 'CN', 'TAO', '칭다오', 85, 36.0671, 120.3826, false),
  ('zhangjiajie', '장자제', 'Zhangjiajie', 'CN', 'DYG', '장자제', 230, 29.1171, 110.4792, false),
  ('hongkong', '홍콩', 'Hong Kong', 'HK', 'HKG', '홍콩', 220, 22.2988, 114.1722, true),
  ('macau', '마카오', 'Macau', 'MO', 'MFM', '마카오', 215, 22.1987, 113.5439, true),
  ('taipei', '타이베이', 'Taipei', 'TW', 'TPE', '타이베이 · 타오위안', 150, 25.033, 121.5654, true),
  ('kaohsiung', '가오슝', 'Kaohsiung', 'TW', 'KHH', '가오슝', 180, 22.6273, 120.3014, true),
  ('bangkok', '방콕', 'Bangkok', 'TH', 'BKK', '방콕 · 수완나품', 345, 13.7563, 100.5018, true),
  ('chiangmai', '치앙마이', 'Chiang Mai', 'TH', 'CNX', '치앙마이', 340, 18.7883, 98.9853, true),
  ('phuket', '푸껫', 'Phuket', 'TH', 'HKT', '푸껫', 380, 7.8804, 98.3923, true),
  ('danang', '다낭', 'Da Nang', 'VN', 'DAD', '다낭', 270, 16.0544, 108.2022, true),
  ('hanoi', '하노이', 'Hanoi', 'VN', 'HAN', '하노이 · 노이바이', 270, 21.0278, 105.8342, true),
  ('hochiminh', '호찌민', 'Ho Chi Minh', 'VN', 'SGN', '호찌민 · 떤선녓', 320, 10.7769, 106.7009, true),
  ('nhatrang', '나트랑', 'Nha Trang', 'VN', 'CXR', '나트랑 · 깜라인', 330, 12.2388, 109.1967, true),
  ('phuquoc', '푸꾸옥', 'Phu Quoc', 'VN', 'PQC', '푸꾸옥', 360, 10.2899, 103.984, true),
  ('cebu', '세부', 'Cebu', 'PH', 'CEB', '세부 · 막탄', 290, 10.3157, 123.8854, true),
  ('manila', '마닐라', 'Manila', 'PH', 'MNL', '마닐라', 240, 14.5995, 120.9842, true),
  ('boracay', '보라카이', 'Boracay', 'PH', 'MPH', '보라카이 · 칼리보', 270, 11.9674, 121.9248, true),
  ('bohol', '보홀', 'Bohol', 'PH', 'TAG', '보홀 · 팡라오', 300, 9.6496, 123.8547, true),
  ('singapore', '싱가포르', 'Singapore', 'SG', 'SIN', '싱가포르 · 창이', 380, 1.2903, 103.852, true),
  ('kualalumpur', '쿠알라룸푸르', 'Kuala Lumpur', 'MY', 'KUL', '쿠알라룸푸르', 390, 3.139, 101.6869, true),
  ('kotakinabalu', '코타키나발루', 'Kota Kinabalu', 'MY', 'BKI', '코타키나발루', 300, 5.9804, 116.0735, true),
  ('bali', '발리', 'Bali', 'ID', 'DPS', '발리 · 응우라라이', 420, -8.65, 115.2167, true),
  ('siemreap', '시엠레아프', 'Siem Reap', 'KH', 'SAI', '시엠레아프 · 앙코르', 350, 13.3671, 103.8448, true),
  ('vientiane', '비엔티안', 'Vientiane', 'LA', 'VTE', '비엔티안', 330, 17.9757, 102.6331, true),
  ('ulaanbaatar', '울란바토르', 'Ulaanbaatar', 'MN', 'UBN', '울란바토르 · 칭기즈칸', 210, 47.8864, 106.9057, false),
  ('delhi', '델리', 'Delhi', 'IN', 'DEL', '델리', 520, 28.6139, 77.209, true),
  ('dubai', '두바이', 'Dubai', 'AE', 'DXB', '두바이', 570, 25.2048, 55.2708, true),
  ('istanbul', '이스탄불', 'Istanbul', 'TR', 'IST', '이스탄불', 720, 41.0082, 28.9784, false),
  ('newyork', '뉴욕', 'New York', 'US', 'JFK', '뉴욕 · JFK', 840, 40.7128, -74.006, false),
  ('losangeles', '로스앤젤레스', 'Los Angeles', 'US', 'LAX', '로스앤젤레스', 660, 34.0522, -118.2437, false),
  ('sanfrancisco', '샌프란시스코', 'San Francisco', 'US', 'SFO', '샌프란시스코', 640, 37.7749, -122.4194, false),
  ('lasvegas', '라스베이거스', 'Las Vegas', 'US', 'LAS', '라스베이거스', 690, 36.1699, -115.1398, false),
  ('seattle', '시애틀', 'Seattle', 'US', 'SEA', '시애틀', 600, 47.6062, -122.3321, false),
  ('hawaii', '하와이', 'Honolulu', 'US', 'HNL', '하와이 · 호놀룰루', 510, 21.2793, -157.8292, true),
  ('guam', '괌', 'Guam', 'US', 'GUM', '괌', 260, 13.4443, 144.7937, true),
  ('saipan', '사이판', 'Saipan', 'US', 'SPN', '사이판', 270, 15.185, 145.7467, true),
  ('vancouver', '밴쿠버', 'Vancouver', 'CA', 'YVR', '밴쿠버', 600, 49.2827, -123.1207, false),
  ('toronto', '토론토', 'Toronto', 'CA', 'YYZ', '토론토', 780, 43.6532, -79.3832, false),
  ('cancun', '칸쿤', 'Cancun', 'MX', 'CUN', '칸쿤', 1080, 21.1619, -86.8515, true),
  ('sydney', '시드니', 'Sydney', 'AU', 'SYD', '시드니', 600, -33.8688, 151.2093, false),
  ('melbourne', '멜버른', 'Melbourne', 'AU', 'MEL', '멜버른', 640, -37.8136, 144.9631, false),
  ('brisbane', '브리즈번', 'Brisbane', 'AU', 'BNE', '브리즈번', 580, -27.4698, 153.0251, false),
  ('auckland', '오클랜드', 'Auckland', 'NZ', 'AKL', '오클랜드', 690, -36.8485, 174.7633, false),
  ('queenstown', '퀸스타운', 'Queenstown', 'NZ', 'ZQN', '퀸스타운', 840, -45.0312, 168.6626, false),
  ('london', '런던', 'London', 'GB', 'LHR', '런던 · 히드로', 860, 51.5074, -0.1278, false),
  ('paris', '파리', 'Paris', 'FR', 'CDG', '파리 · 샤를 드골', 830, 48.8566, 2.3522, false),
  ('nice', '니스', 'Nice', 'FR', 'NCE', '니스', 900, 43.7102, 7.262, false),
  ('rome', '로마', 'Rome', 'IT', 'FCO', '로마 · 피우미치노', 790, 41.9028, 12.4964, false),
  ('milan', '밀라노', 'Milan', 'IT', 'MXP', '밀라노 · 말펜사', 770, 45.4642, 9.19, false),
  ('venice', '베네치아', 'Venice', 'IT', 'VCE', '베네치아', 800, 45.4408, 12.3155, false),
  ('florence', '피렌체', 'Florence', 'IT', 'FLR', '피렌체', 820, 43.7696, 11.2558, false),
  ('barcelona', '바르셀로나', 'Barcelona', 'ES', 'BCN', '바르셀로나', 850, 41.3874, 2.1686, false),
  ('madrid', '마드리드', 'Madrid', 'ES', 'MAD', '마드리드', 870, 40.4168, -3.7038, false),
  ('frankfurt', '프랑크푸르트', 'Frankfurt', 'DE', 'FRA', '프랑크푸르트', 780, 50.1109, 8.6821, false),
  ('munich', '뮌헨', 'Munich', 'DE', 'MUC', '뮌헨', 760, 48.1351, 11.582, false),
  ('berlin', '베를린', 'Berlin', 'DE', 'BER', '베를린', 800, 52.52, 13.405, false),
  ('zurich', '취리히', 'Zurich', 'CH', 'ZRH', '취리히', 800, 47.3769, 8.5417, false),
  ('interlaken', '인터라켄', 'Interlaken', 'CH', 'ZRH', '취리히', 800, 46.6863, 7.8632, false),
  ('vienna', '빈', 'Vienna', 'AT', 'VIE', '빈', 770, 48.2082, 16.3738, false),
  ('prague', '프라하', 'Prague', 'CZ', 'PRG', '프라하', 790, 50.0755, 14.4378, false),
  ('budapest', '부다페스트', 'Budapest', 'HU', 'BUD', '부다페스트', 800, 47.4979, 19.0402, false),
  ('amsterdam', '암스테르담', 'Amsterdam', 'NL', 'AMS', '암스테르담 · 스히폴', 800, 52.3676, 4.9041, false),
  ('lisbon', '리스본', 'Lisbon', 'PT', 'LIS', '리스본', 900, 38.7223, -9.1393, false),
  ('porto', '포르투', 'Porto', 'PT', 'OPO', '포르투', 920, 41.1579, -8.6291, false),
  ('athens', '아테네', 'Athens', 'GR', 'ATH', '아테네', 880, 37.9838, 23.7275, false),
  ('santorini', '산토리니', 'Santorini', 'GR', 'JTR', '산토리니', 960, 36.3932, 25.4615, false),
  ('dubrovnik', '두브로브니크', 'Dubrovnik', 'HR', 'DBV', '두브로브니크', 900, 42.6507, 18.0944, false),
  ('cairo', '카이로', 'Cairo', 'EG', 'CAI', '카이로', 780, 30.0444, 31.2357, true);
