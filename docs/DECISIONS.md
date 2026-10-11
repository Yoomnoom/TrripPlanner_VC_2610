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
2026-10-11 · M1 · 로컬 DB는 Postgres 17(config.toml major_version=17) · 마이그레이션 0001~0003과 rls_smoke.sql을 17.11에서 실행해 README 기대 결과와 일치 확인(원래 검증은 16)
2026-10-11 · M2 · 목적지는 Places 자동완성 대신 나라 선택 + 도시 직접 입력 · Google 키가 없는 단계라 M3 키 설정 후 교체
2026-10-11 · M2 · 시트(모달)는 shadcn 대신 네이티브 <dialog>.showModal() · 포커스 트랩·Esc를 브라우저가 제공해 의존성 없이 처리
2026-10-11 · M3 · 장소 검색은 PlacesProvider(search/details/coords), 이동 정보는 RoutesProvider(getLeg)+withFallback 뒤에 두고 지금은 직접 입력·직선거리 추정 구현만 연결 · Google 키 없이 진행, 키가 생기면 구현체만 추가
2026-10-11 · M3 · 직접 입력 장소의 좌표는 선택 입력(위도, 경도) · 좌표가 없으면 이동 칩을 만들 수 없어서 추정치 확인용으로 둠
2026-10-11 · M3 · 새 의존성 @dnd-kit/core·sortable·utilities(드래그 정렬, SPEC 4-4 지정)
2026-10-11 · M4 · routes-leg는 경로가 없으면 서버 추정 대신 {leg:null}을 반환하고 클라이언트 withFallback이 추정 · geo.ts를 Deno 함수와 공유하면 .ts 확장자 import가 tsc와 충돌해서 공식을 한 곳(클라이언트)에만 둠
2026-10-11 · M4 · 구글 키 감지는 VITE_GOOGLE_MAPS_BROWSER_KEY 유무 하나로 통일(지도·Routes 제공자 전환) · 키가 들어오면 코드 수정 없이 켜짐
2026-10-11 · M4 · 새 의존성 @vis.gl/react-google-maps(지도, SPEC 4-6 지정), @types/google.maps(dev, 타입)
2026-10-11 · M5 · FullCalendar 6.1.x로 통일 · react/core 7.x와 timegrid/interaction 6.x를 섞으면 호환되지 않음
2026-10-11 · M7 · 목적지 통화 기본값 대신 마지막 사용 통화를 기본값으로 · 목적지 통화 데이터는 M14(country-info)에서 생기므로 그때 교체
2026-10-11 · M7 · 새 의존성 recharts(도넛·막대, SPEC 지정, 라우트 lazy)
2026-10-11 · M7 · fx-rate는 Frankfurter v1(api.frankfurter.dev) 사용 · 2026-10-12 실제 호출로 JPY 성공/VND 미지원(404→rate null) 확인
2026-10-12 · M9 · AI 스키마를 supabase/functions/_shared/schemas.ts로 옮기고 src/schemas/ai.ts는 재export · Deno와 앱이 같은 파일을 쓰도록(tsconfig allowImportingTsExtensions)
2026-10-12 · M9 · Gemini 기본 모델은 ListModels로 가장 새 gemini-X-flash를 자동 선택(DEFAULT_GEMINI_MODEL이 우선) · 모델명 하드코딩 금지(규칙 7), 실제로 gemini-2.5-flash가 404였음
2026-10-12 · M9 · AI_FAKE=1이면 결정적 가짜 제공자로 키 없이 채팅→제안→적용 흐름 검증 · 무인 모드 요구사항(키 없이도 끝까지 동작)
2026-10-12 · M9 · DAILY_LIMIT_AI=30은 supabase/functions/.env 수정 금지(deny)로 직접 못 넣음 → HUMAN_TODO에 안내, 테스트 호출은 최소로
2026-10-12 · M10 · 실내 대안 칩은 is_indoor=false 또는 미지정+야외 성격 카테고리(관광/액티비티)에만 표시 · SPEC의 "is_indoor=false(또는 야외 카테고리)"를 null 처리까지 구체화
2026-10-12 · M10 · 장소 교체 시 다음 장소의 이동 캐시도 함께 무효화 · 캐시가 장소 id 기준이라 좌표가 바뀌어도 신선하다고 오판하기 때문
