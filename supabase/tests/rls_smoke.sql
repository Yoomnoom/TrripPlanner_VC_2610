-- rls_smoke.sql — 권한/RPC 동작 스모크 테스트 (psql 전용, \gset 사용)
-- 반드시 테스트용 DB에서 실행한다(여행/멤버 데이터가 남는다). 로컬 Supabase는 'supabase db reset'으로 초기화.
-- 각 구역의 기대 결과는 README.md 참고.
\set ON_ERROR_STOP off
\pset pager off
-- 사용자: A(소유자) B(멤버) C(외부) D(신규)
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''
\set D '''dddddddd-0000-0000-0000-000000000004'''

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;

\echo '--- 1. A가 여행 생성'
set role authenticated;
select set_config('request.jwt.claim.sub', :A, false);
select create_trip('도쿄 3박4일', '2026-12-01', '2026-12-04', 'A', '[{"country_code":"JP","city":"도쿄","lat":35.68,"lng":139.76}]'::jsonb) as trip \gset
select invite_token as tok from trips where id = :'trip' \gset
select 'A trips visible', count(*) from trips;
select 'A members', count(*) from members;

\echo '--- 2. B 입장, C 외부 접근 차단'
select set_config('request.jwt.claim.sub', :B, false);
select join_trip(:'tok', 'B') = :'trip'::uuid as b_joined;
select 'B members', count(*) from members;
select set_config('request.jwt.claim.sub', :C, false);
select 'C sees trips', count(*) from trips;
select 'C sees members', count(*) from members;
select join_trip('wrongtoken', 'C');

\echo '--- 3. 권한 상승 차단 (기대: 모두 permission denied)'
select set_config('request.jwt.claim.sub', :B, false);
update members set role = 'owner' where user_id = :B::uuid;
update trips set invite_token = 'hacked' where id = :'trip';
update trips set title = '제목수정' where id = :'trip';
select 'title after B update', title from trips where id = :'trip';
insert into trips(title,start_date,end_date) values ('x','2026-01-01','2026-01-02');
insert into members(trip_id,user_id,nickname) values (:'trip', :C::uuid, 'evil');
delete from trips where id = :'trip';

\echo '--- 4. 장소 CRUD (멤버 가능, 외부 불가)'
select set_config('request.jwt.claim.sub', :B, false);
insert into places(trip_id, day_index, start_time, end_time, position, name, category, lat, lng)
  values (:'trip', 0, '09:00', '10:00', 1, '센소지', 'sightseeing', 35.71, 139.79),
         (:'trip', 0, '12:00', '13:00', 2, '점심', 'food', 35.70, 139.78),
         (:'trip', null, null, null, 0, '아이디어', 'cafe', 35.7, 139.7);
select 'B places', count(*) from places;
select set_config('request.jwt.claim.sub', :C, false);
select 'C places', count(*) from places;
insert into places(trip_id, name) values (:'trip', 'intruder');

\echo '--- 5. 지출 RPC: 직접 insert 거부, 합계 불일치 거부, 정상 저장'
select set_config('request.jwt.claim.sub', :B, false);
select id as ma from members where user_id = :A::uuid \gset
select id as mb from members where user_id = :B::uuid \gset
insert into expenses(trip_id,title,amount,currency,amount_krw,paid_by) values (:'trip','직접',1000,'KRW',1000,:'ma');
select save_expense(:'trip', null,
  jsonb_build_object('title','스시','amount',1480,'currency','JPY','exchange_rate',9.2,'amount_krw',13616,'paid_by',:'ma'::text,'day_index',0,'category','food'),
  jsonb_build_array(jsonb_build_object('member_id',:'ma','share_krw',6808), jsonb_build_object('member_id',:'mb','share_krw',6000)));
select save_expense(:'trip', null,
  jsonb_build_object('title','스시','amount',1480,'currency','JPY','exchange_rate',9.2,'amount_krw',13616,'paid_by',:'ma'::text),
  jsonb_build_array(jsonb_build_object('member_id',:'ma','share_krw',6808), jsonb_build_object('member_id',:'mb','share_krw',6808)));
select save_expense(:'trip', null,
  jsonb_build_object('title','불일치환산','amount',1480,'currency','JPY','exchange_rate',9.2,'amount_krw',99999,'paid_by',:'ma'::text),
  jsonb_build_array(jsonb_build_object('member_id',:'ma','share_krw',99999)));
select save_expense(:'trip', null,
  jsonb_build_object('title','택시','amount',30000,'currency','KRW','exchange_rate',1,'amount_krw',30000,'paid_by',:'ma'::text,'day_index',0,'category','transport'),
  jsonb_build_array(jsonb_build_object('member_id',:'ma','share_krw',10000), jsonb_build_object('member_id',:'mb','share_krw',20000)));
select 'expenses', count(*), sum(amount_krw) from expenses;
select 'splits', count(*), sum(share_krw) from expense_splits;
update expenses set amount_krw = 1 where trip_id = :'trip';
\echo '외부 사용자 지출 저장 시도 (기대: forbidden)'
select set_config('request.jwt.claim.sub', :C, false);
select save_expense(:'trip', null, '{"title":"x","amount":1,"currency":"KRW","amount_krw":1,"paid_by":"00000000-0000-0000-0000-000000000000"}'::jsonb, '[]'::jsonb);

\echo '--- 6. 정산 기록 (같은 여행 멤버 사이만)'
select set_config('request.jwt.claim.sub', :B, false);
insert into settlements(trip_id, from_member, to_member, amount_krw) values (:'trip', :'mb', :'ma', 20000);
insert into settlements(trip_id, from_member, to_member, amount_krw) values (:'trip', :'mb', gen_random_uuid(), 100);
select 'settlements', count(*) from settlements;

\echo '--- 7. 후기: 본인 멤버 id로만 작성'
select id as p1 from places where name = '센소지' \gset
insert into place_reviews(trip_id, place_id, member_id, rating, comment) values (:'trip', :'p1', :'ma', 5, 'B가 A인 척');
insert into place_reviews(trip_id, place_id, member_id, rating, comment) values (:'trip', :'p1', :'mb', 5, '좋아요');
select 'reviews', count(*) from place_reviews;

\echo '--- 8. 공유 중지/재발급 (소유자만)'
select set_invite(:'trip', false);
select set_config('request.jwt.claim.sub', :A, false);
select set_invite(:'trip', false) is null as disabled;
select set_config('request.jwt.claim.sub', :D, false);
select join_trip(:'tok', 'D');
select set_config('request.jwt.claim.sub', :A, false);
select set_invite(:'trip', true) as newtok \gset
select set_config('request.jwt.claim.sub', :D, false);
select join_trip(:'tok', 'D') ;   -- 옛 토큰 → 실패
select join_trip(:'newtok', 'D') = :'trip'::uuid as d_joined_new;
select 'members now', count(*) from members;

\echo '--- 9. 읽기 전용 공유: anon이 get_shared_trip만 가능'
select set_config('request.jwt.claim.sub', :A, false);
select set_view_link(:'trip', true) as vtok \gset
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
select jsonb_array_length(get_shared_trip(:'vtok')->'places') as shared_places, (get_shared_trip(:'vtok') ? 'expenses') as leaks_expenses;
select count(*) from expenses;
select count(*) from places;
\echo '아래는 외부 인증 사용자 C가 view_token으로 가져오기/직접 접근'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :C, false);
select 'C expenses', count(*) from expenses;
select import_shared_trip(:'vtok', '가져온 일정', '2027-03-01', 'C') as imported \gset
select 'imported places', count(*), min(day_index) from places where trip_id = :'imported';
select 'imported end_date', end_date from trips where id = :'imported';
select 'C sees original places', count(*) from places where trip_id = :'trip';
select duplicate_trip(:'trip', 'x', '2027-01-01', 'C2');
select _copy_trip(:'trip', 'x', '2027-01-01', 'C3', false);

\echo '--- 10. 멤버 복제 / 소유자 아님 공유 변경'
select set_config('request.jwt.claim.sub', :B, false);
select duplicate_trip(:'trip', '복제본', '2027-02-01', 'B2') as dup \gset
select 'dup places', count(*) from places where trip_id = :'dup';
select set_view_link(:'trip', true);

\echo '--- 11. 사용량 한도'
reset role; set role authenticated;
select bump_usage(:A::uuid, 'ai', 2);
set role service_role;
select bump_usage(:A::uuid, 'ai', 2) as n1, bump_usage(:A::uuid, 'ai', 2) as n2, bump_usage(:A::uuid, 'ai', 2) as n3_should_be_false;

\echo '--- 12. 채팅 메시지: 클라이언트 insert 불가, service_role 가능, proposal_applied만 수정'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :B, false);
insert into chat_messages(trip_id, role, content) values (:'trip','assistant','가짜');
set role service_role;
insert into chat_messages(trip_id, role, content, proposal) values (:'trip','assistant','제안','{"a":1}');
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :B, false);
update chat_messages set proposal_applied = true where trip_id = :'trip';
update chat_messages set content = '변조' where trip_id = :'trip';
select 'chat', content, proposal_applied from chat_messages where trip_id = :'trip';

\echo '--- 13. 발자취/저장은 본인만'
insert into footprints(kind, code, status) values ('country','JP','visited');
select set_config('request.jwt.claim.sub', :C, false);
select 'C sees footprints', count(*) from footprints;
insert into saved_places(google_place_id, name) values ('abc','카페');
select set_config('request.jwt.claim.sub', :B, false);
select 'B sees saved', count(*) from saved_places;

\echo '--- 14. Storage 정책'
select set_config('request.jwt.claim.sub', :B, false);
insert into storage.objects(bucket_id, name) values ('receipts', :'trip' || '/r1.jpg');
insert into storage.objects(bucket_id, name) values ('receipts', 'not-a-uuid/r1.jpg');
select set_config('request.jwt.claim.sub', :C, false);
select 'C storage visible', count(*) from storage.objects;
select set_config('request.jwt.claim.sub', :B, false);
select 'B storage visible', count(*) from storage.objects;

\echo '--- 15. 멤버 삭제: 분담 기록 있으면 거부, 소유자만 타인 삭제'
select set_config('request.jwt.claim.sub', :B, false);
delete from members where id = :'ma';
select set_config('request.jwt.claim.sub', :A, false);
delete from members where id = :'mb';

\echo '--- 16. 여행 삭제 (소유자) — 연쇄 삭제 확인'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', :A, false);
delete from trips where id = :'trip';
reset role;
select 'left', (select count(*) from trips where id = :'trip') as trips, (select count(*) from places where trip_id = :'trip') as places, (select count(*) from expenses where trip_id = :'trip') as expenses;
