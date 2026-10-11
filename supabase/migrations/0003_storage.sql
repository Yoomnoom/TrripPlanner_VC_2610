-- 0003_storage.sql — Storage 버킷과 정책 (모두 private, 경로 첫 세그먼트 = trip_id)

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('trip-files',  'trip-files',  false, 20971520),   -- 20MB
  ('receipts',    'receipts',    false, 5242880),    -- 5MB
  ('place-photos','place-photos',false, 5242880)     -- 5MB
on conflict (id) do nothing;

-- 경로 첫 세그먼트를 uuid로 해석, 실패하면 null(= 접근 거부)
create or replace function storage_trip_id(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end; $$;

create policy "trip members manage trip files" on storage.objects for all to authenticated
  using (bucket_id in ('trip-files','receipts','place-photos') and public.is_trip_member(public.storage_trip_id(name)))
  with check (bucket_id in ('trip-files','receipts','place-photos') and public.is_trip_member(public.storage_trip_id(name)));
