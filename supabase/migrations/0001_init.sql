-- 0001_init.sql — 핵심 스키마, RLS, RPC
-- 실행 환경: Supabase (Postgres). auth.uid(), 역할(anon/authenticated/service_role)은 Supabase가 제공한다.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- 공용
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

-- ---------------------------------------------------------------- 테이블
create table trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  headcount int,
  budget_krw bigint,
  cover_emoji text default '✈️',
  base_currency char(3) not null default 'KRW',
  invite_token text unique,                    -- null이면 공유 중지
  ai_provider text not null default 'gemini' check (ai_provider in ('gemini','openrouter')),
  ai_model text,
  ai_fallback boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trips_updated before update on trips for each row execute function set_updated_at();

create table trip_destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  country_code char(2) not null,
  city text,
  lat double precision,
  lng double precision,
  position int not null default 0
);
create index on trip_destinations(trip_id);

create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  role text not null default 'member' check (role in ('owner','member')),
  color text not null default '#6D4AFF',
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id),
  unique (trip_id, nickname)
);
create index on members(user_id);

create table places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_index int check (day_index >= 0),        -- null = 아이디어 보관함
  start_time time,
  end_time time,
  position double precision not null default 0,
  name text not null,
  category text not null default 'other'
    check (category in ('food','cafe','sightseeing','shopping','activity','lodging','transport','other')),
  google_place_id text,
  address text,
  lat double precision,
  lng double precision,
  is_indoor boolean,
  note text,
  source text not null default 'manual' check (source in ('manual','ai','explore')),
  leg_mode text check (leg_mode in ('walk','transit','drive')),
  leg_duration_s int,
  leg_distance_m int,
  leg_polyline text,
  leg_estimated boolean not null default false,
  leg_from_place_id uuid,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on places(trip_id, day_index, position);
create trigger places_updated before update on places for each row execute function set_updated_at();

create table reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  type text not null default 'other'
    check (type in ('flight','lodging','transport','restaurant','ticket','other')),
  title text not null,
  starts_at timestamp,
  ends_at timestamp,
  confirmation_no text,
  place_id uuid references places(id) on delete set null,
  url text,
  amount numeric,
  currency char(3),
  note text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on reservations(trip_id, starts_at);

create table trip_files (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  kind text not null check (kind in ('file','link')),
  title text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  url text,
  reservation_id uuid references reservations(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on trip_files(trip_id);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  section text not null check (section in ('before','packing')),
  title text not null,
  checked boolean not null default false,
  checked_by uuid,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index on checklist_items(trip_id, section, position);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_index int,
  spent_on date,
  title text not null,
  category text not null default 'other'
    check (category in ('transport','lodging','food','shopping','ticket','other')),
  amount numeric not null check (amount >= 0),
  currency char(3) not null,
  exchange_rate numeric not null default 1 check (exchange_rate > 0),
  amount_krw bigint not null check (amount_krw >= 0),
  payment_method text not null default 'card' check (payment_method in ('cash','card','transfer','other')),
  paid_by uuid not null references members(id) deferrable initially deferred,
  place_id uuid references places(id) on delete set null,
  place_label text,
  memo text,
  receipt_path text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on expenses(trip_id, day_index);
create trigger expenses_updated before update on expenses for each row execute function set_updated_at();

create table expense_splits (
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id) deferrable initially deferred,  -- 분담 기록이 있는 멤버는 삭제 불가(커밋 시점 검사: 여행 삭제 시 연쇄 삭제는 허용)
  share_krw bigint not null check (share_krw >= 0),
  primary key (expense_id, member_id)
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_member uuid not null references members(id) deferrable initially deferred,
  to_member uuid not null references members(id) deferrable initially deferred,
  amount_krw bigint not null check (amount_krw > 0),
  settled_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  check (from_member <> to_member)
);
create index on settlements(trip_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  proposal jsonb,
  proposal_applied boolean not null default false,
  member_id uuid references members(id) on delete set null,
  provider text,
  model text,
  created_at timestamptz not null default now()
);
create index on chat_messages(trip_id, created_at);

create table footprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('country','region')),
  code text not null,
  status text not null check (status in ('visited','wish')),
  period text,
  memo text,
  trip_id uuid references trips(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, code)
);

create table api_usage (
  user_id uuid not null,
  day date not null,
  kind text not null,
  count int not null default 0,
  primary key (user_id, day, kind)
);

-- ---------------------------------------------------------------- 권한 헬퍼
create or replace function is_trip_member(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members m where m.trip_id = t and m.user_id = auth.uid());
$$;

create or replace function is_trip_owner(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members m where m.trip_id = t and m.user_id = auth.uid() and m.role = 'owner');
$$;

create or replace function is_me(m uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members x where x.id = m and x.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- RLS
alter table trips enable row level security;
alter table trip_destinations enable row level security;
alter table members enable row level security;
alter table places enable row level security;
alter table reservations enable row level security;
alter table trip_files enable row level security;
alter table checklist_items enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;
alter table chat_messages enable row level security;
alter table footprints enable row level security;
alter table api_usage enable row level security;   -- 정책 없음: service_role 전용

-- trips: 생성/삭제 외 RPC 의존. 직접 insert 불가.
create policy trips_select on trips for select using (is_trip_member(id));
create policy trips_update on trips for update using (is_trip_member(id)) with check (is_trip_member(id));
create policy trips_delete on trips for delete using (is_trip_owner(id));

-- members: insert는 RPC만. 본인 행만 수정(닉네임/색), 소유자는 타인 삭제 가능
create policy members_select on members for select using (is_trip_member(trip_id));
create policy members_update_self on members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete on members for delete using (is_trip_owner(trip_id) or user_id = auth.uid());

-- trip_id를 가진 일반 테이블: 멤버 전체 권한
create policy trip_destinations_all on trip_destinations for all
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy places_all on places for all
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy reservations_all on reservations for all
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy trip_files_all on trip_files for all
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy checklist_items_all on checklist_items for all
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));

-- expenses / expense_splits: 조회·삭제만 직접, 쓰기는 save_expense RPC
create policy expenses_select on expenses for select using (is_trip_member(trip_id));
create policy expenses_delete on expenses for delete using (is_trip_member(trip_id));
create policy expense_splits_select on expense_splits for select
  using (exists (select 1 from expenses e where e.id = expense_id and is_trip_member(e.trip_id)));

-- settlements: 같은 여행 멤버 사이의 기록만
create policy settlements_select on settlements for select using (is_trip_member(trip_id));
create policy settlements_insert on settlements for insert with check (
  is_trip_member(trip_id)
  and exists (select 1 from members m where m.id = from_member and m.trip_id = settlements.trip_id)
  and exists (select 1 from members m where m.id = to_member and m.trip_id = settlements.trip_id)
);
create policy settlements_delete on settlements for delete using (is_trip_member(trip_id));

-- chat_messages: 조회는 멤버, 저장은 Edge Function(service_role), proposal_applied만 멤버가 수정
create policy chat_messages_select on chat_messages for select using (is_trip_member(trip_id));
create policy chat_messages_update on chat_messages for update
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));

-- footprints: 본인 것만
create policy footprints_own on footprints for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- 컬럼 단위 권한 (권한 상승 방지)
revoke all on all tables in schema public from anon;

revoke update on trips from authenticated;
grant update (title, start_date, end_date, headcount, budget_krw, cover_emoji, base_currency,
              ai_provider, ai_model, ai_fallback) on trips to authenticated;
revoke insert on trips from authenticated;

revoke update on members from authenticated;
grant update (nickname, color) on members to authenticated;
revoke insert on members from authenticated;

revoke insert, update on expenses from authenticated;
revoke insert, update, delete on expense_splits from authenticated;

revoke insert, delete on chat_messages from authenticated;
revoke update on chat_messages from authenticated;
grant update (proposal_applied) on chat_messages to authenticated;

revoke all on api_usage from authenticated;

-- ---------------------------------------------------------------- RPC
-- 여행 생성: trips + owner 멤버 + 목적지 + 초대 토큰
create or replace function create_trip(
  p_title text, p_start date, p_end date, p_nickname text,
  p_destinations jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_trip uuid; v_token text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_token := translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'abc');
  insert into trips(title, start_date, end_date, invite_token, created_by)
    values (p_title, p_start, p_end, v_token, auth.uid()) returning id into v_trip;
  insert into members(trip_id, user_id, nickname, role) values (v_trip, auth.uid(), p_nickname, 'owner');
  insert into trip_destinations(trip_id, country_code, city, lat, lng, position)
    select v_trip, d->>'country_code', d->>'city', (d->>'lat')::float8, (d->>'lng')::float8, (ord - 1)::int
    from jsonb_array_elements(coalesce(p_destinations, '[]'::jsonb)) with ordinality as t(d, ord);
  return v_trip;
end; $$;

-- 입장: 토큰 검증, 같은 닉네임이 있으면 기존 멤버에 재연결
create or replace function join_trip(p_token text, p_nickname text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_trip uuid; v_member uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into v_trip from trips where invite_token = p_token;
  if v_trip is null then raise exception 'invalid or disabled invite'; end if;
  select id into v_member from members where trip_id = v_trip and user_id = auth.uid();
  if v_member is not null then
    update members set nickname = p_nickname where id = v_member;
    return v_trip;
  end if;
  select id into v_member from members where trip_id = v_trip and nickname = p_nickname;
  if v_member is not null then
    update members set user_id = auth.uid() where id = v_member;
  else
    insert into members(trip_id, user_id, nickname) values (v_trip, auth.uid(), p_nickname);
  end if;
  return v_trip;
end; $$;

-- 입장 전 미리보기(제목/날짜/인원수만)
create or replace function peek_invite(p_token text)
returns table(title text, start_date date, end_date date, member_count int)
language sql security definer stable set search_path = public as $$
  select t.title, t.start_date, t.end_date,
         (select count(*)::int from members m where m.trip_id = t.id)
  from trips t where t.invite_token = p_token;
$$;

-- 공유 켜기(새 토큰)/끄기(null) — 소유자만
create or replace function set_invite(p_trip uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not is_trip_owner(p_trip) then raise exception 'forbidden'; end if;
  if p_enabled then
    v_token := translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'abc');
  end if;
  update trips set invite_token = v_token where id = p_trip;
  return v_token;
end; $$;

-- 지출 저장(생성/수정): 분담 합계 = amount_krw 검증, 같은 여행 멤버 검증, 한 트랜잭션
create or replace function save_expense(p_trip uuid, p_id uuid, p_data jsonb, p_splits jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_amount numeric; v_rate numeric; v_krw bigint; v_sum bigint; v_payer uuid;
begin
  if not is_trip_member(p_trip) then raise exception 'forbidden'; end if;
  if exists (select 1 from expenses where id = v_id and trip_id <> p_trip) then
    raise exception 'expense belongs to another trip';
  end if;
  v_amount := (p_data->>'amount')::numeric;
  v_rate   := coalesce((p_data->>'exchange_rate')::numeric, 1);
  v_krw    := (p_data->>'amount_krw')::bigint;
  v_payer  := (p_data->>'paid_by')::uuid;
  if abs(v_krw - round(v_amount * v_rate)) > 1 then
    raise exception 'amount_krw does not match amount * exchange_rate';
  end if;
  select coalesce(sum((s->>'share_krw')::bigint), 0) into v_sum from jsonb_array_elements(p_splits) s;
  if v_sum <> v_krw then
    raise exception 'splits must sum to amount_krw (% vs %)', v_sum, v_krw;
  end if;
  if not exists (select 1 from members where id = v_payer and trip_id = p_trip) then
    raise exception 'invalid payer';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_splits) s
    where not exists (select 1 from members m where m.id = (s->>'member_id')::uuid and m.trip_id = p_trip)
  ) then raise exception 'invalid member in splits'; end if;

  insert into expenses(id, trip_id, day_index, spent_on, title, category, amount, currency,
                       exchange_rate, amount_krw, payment_method, paid_by, place_id, place_label, memo, receipt_path)
  values (v_id, p_trip, (p_data->>'day_index')::int, (p_data->>'spent_on')::date, p_data->>'title',
          coalesce(p_data->>'category', 'other'), v_amount, p_data->>'currency', v_rate, v_krw,
          coalesce(p_data->>'payment_method', 'card'), v_payer, (p_data->>'place_id')::uuid,
          p_data->>'place_label', p_data->>'memo', p_data->>'receipt_path')
  on conflict (id) do update set
    day_index = excluded.day_index, spent_on = excluded.spent_on, title = excluded.title,
    category = excluded.category, amount = excluded.amount, currency = excluded.currency,
    exchange_rate = excluded.exchange_rate, amount_krw = excluded.amount_krw,
    payment_method = excluded.payment_method, paid_by = excluded.paid_by, place_id = excluded.place_id,
    place_label = excluded.place_label, memo = excluded.memo, receipt_path = excluded.receipt_path;

  delete from expense_splits where expense_id = v_id;
  insert into expense_splits(expense_id, member_id, share_krw)
    select v_id, (s->>'member_id')::uuid, (s->>'share_krw')::bigint from jsonb_array_elements(p_splits) s;
  return v_id;
end; $$;

-- API 사용량 카운트(Edge Function이 service_role로 호출). 한도 초과면 false.
create or replace function bump_usage(p_user uuid, p_kind text, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into api_usage(user_id, day, kind, count)
    values (p_user, (now() at time zone 'Asia/Seoul')::date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = api_usage.count + 1
    where api_usage.count < p_limit
  returning count into v;
  return v is not null;
end; $$;
revoke execute on function bump_usage(uuid, text, int) from public, anon, authenticated;
grant execute on function bump_usage(uuid, text, int) to service_role;

-- ---------------------------------------------------------------- Realtime
alter table places replica identity full;
alter table checklist_items replica identity full;
alter table expenses replica identity full;
alter table expense_splits replica identity full;
alter table settlements replica identity full;
alter table reservations replica identity full;
alter table trip_files replica identity full;
alter table members replica identity full;

alter publication supabase_realtime add table
  trips, members, places, reservations, trip_files, checklist_items,
  expenses, expense_splits, settlements, chat_messages;
