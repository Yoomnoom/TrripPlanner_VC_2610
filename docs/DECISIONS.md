# DECISIONS

문서(`docs/SPEC.md`)와 다르게 구현했거나 새로 정한 사항을 한 줄씩 남깁니다. 형식: `날짜 · 단계 · 결정 · 이유`

## 설계 시점에 이미 정해진 것 (참고)

- 예약·자료·아이디어 화면은 원본 영상에 상세 화면이 없어 임의 설계함 (SPEC 8부 1번).
- "이 지역 릴스"는 구현하지 않고 외부 검색 링크로 대체함.
- 발자취는 여행과 별개의 개인 데이터. 기기 변경은 JSON 내보내기/가져오기로 이전.
- 한국 구간 이동 시간은 Google 제한으로 추정치가 많음. 필요하면 카카오/네이버/T맵 어댑터 추가.
- 스키마 검증 중 보강한 사항(마이그레이션에 반영됨):
  - 컬럼 단위 권한으로 권한 상승 방지(`members.role`, `trips.invite_token` 등 직접 수정 불가)
  - 지출 저장을 `save_expense` RPC로 일원화(분담 합계, 환산 일치, 같은 여행 멤버 검증, 멱등)
  - `chat_messages` 생성은 Edge Function(service_role)만
  - 멤버 FK를 `deferrable initially deferred`로 둬서 여행 삭제는 허용, 기록 있는 멤버 삭제는 거부
  - `bump_usage` RPC로 API 한도 카운트
  - `place_reviews`는 본인 멤버 id로만 작성

## 구현 중 결정 (여기부터 기록)

2026-10-11 · M0 · Tailwind v4(@theme in src/index.css) 사용 · SPEC은 theme.extend라고 했으나 최신 Tailwind는 CSS 토큰 방식이라 같은 토큰을 CSS로 정의함
2026-10-11 · M0 · zod 3.25 고정 · starter가 zod 3으로 검증됨(zod 4는 API가 달라 Edge Function 공유 시 위험)
2026-10-11 · M0 · TypeScript 5.9, ESLint 9 고정 · typescript-eslint가 TS 7 / ESLint 10을 아직 지원하지 않음
2026-10-11 · M0 · pnpm·Supabase CLI는 전역 설치 없이 `npx pnpm@11.16.0` / `npx supabase`로 실행 · 사용자 PC 환경을 바꾸지 않기 위해
2026-10-11 · M0 · shadcn/ui는 components.json만 설정하고 컴포넌트는 필요한 단계에서 추가 · 미사용 코드 방지
