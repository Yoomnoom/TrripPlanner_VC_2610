# 권한 스모크 테스트

`rls_smoke.sql`은 사용자 A(소유자), B(멤버), C(외부), D(신규)를 흉내 내며 권한과 RPC를 확인한다. 임시 Postgres 16에서 0001~0003을 적용한 뒤 실행해 아래 결과를 확인했다.

## 실행
- **로컬 Supabase:** `supabase db reset`으로 초기화한 뒤, `supabase status`에 나오는 DB URL로 `psql "<DB URL>" -f supabase/tests/rls_smoke.sql` 실행
- **일반 Postgres:** 빈 DB에 `stub_supabase.sql` → `0001` → `0002` → `0003` 순서로 적용 후 `psql -d <db> -f rls_smoke.sql`
- 출력에서 `ERROR:`가 나오는 줄 중 **기대된 것**과 **기대되지 않은 것**을 아래 표로 구분한다.

## 기대 결과 (구역별)
| 구역 | 기대 |
|---|---|
| 1 | A가 여행 생성, A는 trips 1건·members 1건 조회 |
| 2 | B가 토큰으로 입장(`b_joined = t`), B는 members 2건. C는 trips/members 0건, 잘못된 토큰은 `invalid or disabled invite` |
| 3 | B의 `update members set role`, `update trips set invite_token`, `insert into trips`, `insert into members` 모두 `permission denied`. B가 제목(title) 수정은 성공(멤버 권한). B의 trips 삭제는 0건 |
| 4 | B는 places 3건 조회·입력 가능, C는 0건이고 insert는 RLS 위반 |
| 5 | 직접 `insert into expenses`는 `permission denied`. `save_expense`: 합계 불일치는 `splits must sum...`, 환산 불일치는 `amount_krw does not match...`, 정상은 uuid 반환. 외부(C)는 `forbidden`. 정상 2건 합계 43,616, splits 4행 합계 43,616 |
| 6 | 같은 여행 멤버 사이 정산 기록은 성공, 존재하지 않는 멤버는 RLS 위반 |
| 7 | 다른 멤버 id로 후기 작성은 RLS 위반, 본인 id는 성공 |
| 8 | B의 `set_invite`는 `forbidden`. A가 끄면 D 입장 불가(`invalid or disabled invite`), 재발급 후 새 토큰만 입장 가능, 옛 토큰은 실패 |
| 9 | anon이 `get_shared_trip`으로 places 2건 조회, `leaks_expenses = f`. anon의 expenses/places 직접 조회는 `permission denied`. C는 expenses 0건, `import_shared_trip` 성공(장소 3건, 종료일=시작일+3), C는 원본 places 0건. 비멤버 `duplicate_trip`은 `forbidden`, `_copy_trip` 직접 호출은 `permission denied` |
| 10 | 멤버 B의 `duplicate_trip` 성공(장소 3건), B의 `set_view_link`는 `forbidden` |
| 11 | authenticated의 `bump_usage`는 `permission denied`. service_role: `t, t, f` (한도 2회) |
| 12 | 클라이언트의 chat_messages insert는 `permission denied`, service_role insert 성공, `proposal_applied`만 수정 가능(content 수정은 `permission denied`) |
| 13 | footprints/saved_places는 본인 것만 보임(다른 사용자 0건) |
| 14 | 멤버는 `{trip_id}/...` 경로에 저장 가능, uuid가 아닌 경로는 RLS 위반, 외부는 0건 |
| 15 | B의 타인 멤버 삭제는 0건, A가 분담 기록 있는 B를 삭제하면 FK 오류 |
| 16 | 소유자의 여행 삭제가 연쇄 삭제되어 trips/places/expenses 모두 0건 |
