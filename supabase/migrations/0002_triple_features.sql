-- 0002_triple_features.sql — 후기, 내 저장, 읽기 전용 공유, 여행 복제, AI 마법사/회고 컬럼

alter table trips add column planning_prefs jsonb;
alter table trips add column view_token text unique;     -- 읽기 전용 공유, null이면 중지
alter table trips add column recap jsonb;

grant update (planning_prefs, recap) on trips to authenticated;

create table place_reviews (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, member_id)
);
create index on place_reviews(trip_id);
create trigger place_reviews_updated before update on place_reviews for each row execute function set_updated_at();

create table place_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  storage_path text not null,               -- 버킷 place-photos: {trip_id}/{uuid}.jpg
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on place_photos(trip_id, place_id);

create table saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  google_place_id text not null,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  category text not null default 'other',
  country_code char(2),
  city text,
  memo text,
  created_at timestamptz not null default now(),
  unique (user_id, google_place_id)
);

alter table place_reviews enable row level security;
alter table place_photos enable row level security;
alter table saved_places enable row level security;

-- 후기는 본인(member_id가 내 멤버)만 작성/수정, 조회는 같은 여행 멤버
create policy reviews_select on place_reviews for select using (is_trip_member(trip_id));
create policy reviews_insert on place_reviews for insert
  with check (is_trip_member(trip_id) and is_me(member_id));
create policy reviews_update on place_reviews for update
  using (is_me(member_id)) with check (is_trip_member(trip_id) and is_me(member_id));
create policy reviews_delete on place_reviews for delete using (is_me(member_id));

create policy photos_all on place_photos for all
  using (is_trip_member(trip_id)) with check (is_trip_member(trip_id));
create policy saved_own on saved_places for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on all tables in schema public from anon;

alter table place_reviews replica identity full;
alter table place_photos replica identity full;
alter publication supabase_realtime add table place_reviews, place_photos;

-- 읽기 전용 공유 켜기/끄기 (소유자)
create or replace function set_view_link(p_trip uuid, p_enabled boolean)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not is_trip_owner(p_trip) then raise exception 'forbidden'; end if;
  if p_enabled then
    v_token := translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'abc');
  end if;
  update trips set view_token = v_token where id = p_trip;
  return v_token;
end; $$;

-- 읽기 전용 페이지용 스냅샷: 비용/예약/자료/채팅/멤버는 포함하지 않는다
create or replace function get_shared_trip(p_token text)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'title', t.title, 'startDate', t.start_date, 'endDate', t.end_date,
    'destinations', (select coalesce(jsonb_agg(jsonb_build_object(
        'countryCode', d.country_code, 'city', d.city, 'lat', d.lat, 'lng', d.lng)
        order by d.position), '[]'::jsonb)
      from trip_destinations d where d.trip_id = t.id),
    'places', (select coalesce(jsonb_agg(jsonb_build_object(
        'dayIndex', p.day_index, 'startTime', p.start_time, 'endTime', p.end_time,
        'name', p.name, 'category', p.category, 'address', p.address,
        'lat', p.lat, 'lng', p.lng, 'note', p.note)
        order by p.day_index, p.start_time, p.position), '[]'::jsonb)
      from places p where p.trip_id = t.id and p.day_index is not null),
    'recap', t.recap)
  from trips t where t.view_token = p_token;
$$;
grant execute on function get_shared_trip(text) to anon, authenticated;

-- 여행 복사(내부용)
create or replace function _copy_trip(p_src uuid, p_title text, p_start date, p_nickname text, p_checklist boolean)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_new uuid; v_days int; v_token text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select (end_date - start_date) into v_days from trips where id = p_src;
  v_token := translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'abc');
  insert into trips(title, start_date, end_date, base_currency, headcount, planning_prefs, invite_token, created_by)
    select p_title, p_start, p_start + v_days, base_currency, headcount, planning_prefs, v_token, auth.uid()
    from trips where id = p_src
    returning id into v_new;
  insert into members(trip_id, user_id, nickname, role) values (v_new, auth.uid(), p_nickname, 'owner');
  insert into trip_destinations(trip_id, country_code, city, lat, lng, position)
    select v_new, country_code, city, lat, lng, position from trip_destinations where trip_id = p_src;
  insert into places(trip_id, day_index, start_time, end_time, position, name, category,
                     google_place_id, address, lat, lng, is_indoor, note, source)
    select v_new, day_index, start_time, end_time, position, name, category,
           google_place_id, address, lat, lng, is_indoor, note, source
    from places where trip_id = p_src;
  if p_checklist then
    insert into checklist_items(trip_id, section, title, position)
      select v_new, section, title, position from checklist_items where trip_id = p_src;
  end if;
  return v_new;
end; $$;
revoke execute on function _copy_trip(uuid, text, date, text, boolean) from public, anon, authenticated;

create or replace function duplicate_trip(p_src uuid, p_title text, p_start date, p_nickname text,
                                          p_checklist boolean default true)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_trip_member(p_src) then raise exception 'forbidden'; end if;
  return _copy_trip(p_src, p_title, p_start, p_nickname, p_checklist);
end; $$;

create or replace function import_shared_trip(p_view_token text, p_title text, p_start date, p_nickname text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_src uuid;
begin
  select id into v_src from trips where view_token = p_view_token;
  if v_src is null then raise exception 'invalid or disabled link'; end if;
  return _copy_trip(v_src, p_title, p_start, p_nickname, false);
end; $$;
