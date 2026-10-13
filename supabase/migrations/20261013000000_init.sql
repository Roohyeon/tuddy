-- =========================================================
-- Tuddy 초기 스키마 · RLS
-- 모든 테이블에 user_id가 있고, 로그인한 본인 행만 읽고 쓸 수 있어요 (auth.uid() = user_id).
-- Supabase 대시보드 › SQL Editor에 그대로 붙여 넣거나 `supabase db push`로 적용하세요.
-- =========================================================

-- ---------- 프로필 (계정당 1행) ----------
create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text not null default '여행자' check (char_length(name) between 1 and 12),
  is_demo        boolean not null default false,
  active_trip_id uuid,
  created_at     timestamptz not null default now()
);

-- ---------- 여행 ----------
create table public.trips (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dest       text not null,
  start_date date not null,
  end_date   date not null,
  companion  text not null check (companion in ('혼자', '가족', '친구', '연인')),
  people     smallint not null check (people between 1 and 10),
  budget     integer not null check (budget >= 0),
  rate       double precision not null check (rate > 0),
  rate_mode  text not null default 'manual' check (rate_mode in ('manual', 'live')),
  template   text not null default '',
  titles     text[] not null default '{}',
  flight     jsonb not null,
  notify     jsonb not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date < 30)
);

alter table public.profiles
  add constraint profiles_active_trip_fk foreign key (active_trip_id) references public.trips (id) on delete set null;

-- ---------- 여행 하위 데이터 (모두 trip_id + user_id) ----------
-- id는 앱이 만드는 UUID v7이라 id 순서 = 만든 순서예요.
create table public.schedule_items (
  id      uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  day     smallint not null check (day >= 0),
  time    text not null,
  title   text not null,
  place   text not null default '',
  type    text not null check (type in ('move', 'stay', 'sight', 'food', 'shop', 'rest')),
  area    text not null default '',
  meta    text not null default '',
  memo    text not null default '',
  cost    double precision not null default 0,
  status  text not null default '',
  dur     integer not null default 90,
  lat     double precision,
  lng     double precision,
  leg     jsonb,
  day_was smallint
);

create table public.expenses (
  id      uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title   text not null,
  cat     text not null check (cat in ('flight', 'stay', 'move', 'ins', 'food', 'shop', 'sight', 'etc')),
  krw     integer not null,
  amt     double precision not null,
  cur     text not null,
  date    date not null,
  pay     text not null,
  receipt boolean not null default false
);

create table public.packing_items (
  id      uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  cat     text not null,
  text    text not null,
  sub     text not null default '',
  done    boolean not null default false
);

create table public.dday_items (
  id      uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  text    text not null,
  sub     text,
  tag     text,
  auto    text check (auto in ('ticket')),
  done    boolean not null default false
);

create table public.vault_items (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id    uuid not null references public.trips (id) on delete cascade,
  type       text not null check (type in ('ticket', 'stay', 'move', 'entry', 'receipt', 'etc')),
  title      text not null,
  sub        text not null default '',
  date       date not null,
  -- { name, type, data? } — data는 작은 이미지의 data URL (큰 파일은 이름만)
  file       jsonb,
  link_id    uuid,
  expense_id uuid
);

create index trips_user_idx          on public.trips (user_id);
create index schedule_items_trip_idx on public.schedule_items (trip_id);
create index schedule_items_user_idx on public.schedule_items (user_id);
create index expenses_trip_idx       on public.expenses (trip_id);
create index expenses_user_idx       on public.expenses (user_id);
create index packing_items_trip_idx  on public.packing_items (trip_id);
create index packing_items_user_idx  on public.packing_items (user_id);
create index dday_items_trip_idx     on public.dday_items (trip_id);
create index dday_items_user_idx     on public.dday_items (user_id);
create index vault_items_trip_idx    on public.vault_items (trip_id);
create index vault_items_user_idx    on public.vault_items (user_id);
create index profiles_active_trip_idx on public.profiles (active_trip_id);

-- =========================================================
-- RLS — 본인 행만
-- (select auth.uid())로 감싸면 행마다가 아니라 쿼리당 한 번만 계산돼요.
-- =========================================================
alter table public.profiles       enable row level security;
alter table public.trips          enable row level security;
alter table public.schedule_items enable row level security;
alter table public.expenses       enable row level security;
alter table public.packing_items  enable row level security;
alter table public.dday_items     enable row level security;
alter table public.vault_items    enable row level security;

-- 프로필: 행은 가입 트리거가 만들어요. 앱은 읽기 · 수정만 해요.
create policy "profiles: 본인 조회" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: 본인 수정" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 여행
create policy "trips: 본인 조회" on public.trips
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "trips: 본인 추가" on public.trips
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "trips: 본인 수정" on public.trips
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "trips: 본인 삭제" on public.trips
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 하위 테이블: 본인 행이면서, 붙이는 여행도 본인 것이어야 해요
-- (외래 키 검사는 RLS를 거치지 않아서, 남의 trip_id에 행을 붙이는 것을 여기서 막아요)
do $$
declare t text;
begin
  foreach t in array array['schedule_items', 'expenses', 'packing_items', 'dday_items', 'vault_items'] loop
    execute format($p$
      create policy "%1$s: 본인 조회" on public.%1$I
        for select to authenticated using ((select auth.uid()) = user_id);
      create policy "%1$s: 본인 추가" on public.%1$I
        for insert to authenticated with check (
          (select auth.uid()) = user_id
          and exists (select 1 from public.trips tr where tr.id = trip_id and tr.user_id = (select auth.uid()))
        );
      create policy "%1$s: 본인 수정" on public.%1$I
        for update to authenticated using ((select auth.uid()) = user_id) with check (
          (select auth.uid()) = user_id
          and exists (select 1 from public.trips tr where tr.id = trip_id and tr.user_id = (select auth.uid()))
        );
      create policy "%1$s: 본인 삭제" on public.%1$I
        for delete to authenticated using ((select auth.uid()) = user_id);
    $p$, t);
  end loop;
end $$;

-- 프로필이 가리키는 여행도 본인 것이어야 해요
create or replace function public.check_active_trip() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.active_trip_id is not null and not exists (
    select 1 from public.trips where id = new.active_trip_id and user_id = new.user_id
  ) then
    raise exception 'active_trip_id must reference your own trip';
  end if;
  return new;
end $$;

create trigger profiles_check_active_trip
  before insert or update of active_trip_id on public.profiles
  for each row execute function public.check_active_trip();

-- =========================================================
-- 권한 — 로그인 사용자만 API로 접근 (anon 키만으로는 아무것도 못 읽어요)
-- =========================================================
revoke all on public.profiles, public.trips, public.schedule_items, public.expenses,
  public.packing_items, public.dday_items, public.vault_items from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.trips, public.schedule_items, public.expenses,
  public.packing_items, public.dday_items, public.vault_items to authenticated;

-- =========================================================
-- 가입하면 프로필을 만들어요 (이메일 가입 · 소셜 로그인 · 익명 데모 공통)
-- =========================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, name, is_demo)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '여행자'
    ), 12),
    coalesce(new.is_anonymous, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
