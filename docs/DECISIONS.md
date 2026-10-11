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
2026-10-12 · M11 · 영수증 이미지는 클라이언트에서 긴 변 1600px JPEG 0.8로 줄여 receipts 버킷에 올리고 함수가 사용자 JWT로 내려받음 · service_role 최소화(규칙 6), 경로 검증으로 다른 여행 파일 접근 차단
2026-10-12 · M11 · 예약→비용은 라우터 state로 prefill 전달 · URL 쿼리에 금액 등 개인 데이터를 싣지 않기 위해
2026-10-12 · M11 · 홈 "고정 일정 배너"(항공/숙소)는 선택 구현이라 BACKLOG로 미룸
2026-10-12 · M12 · 한국 시·군 지도는 확대 자동 전환 대신 `세계 / 대한민국` 탭으로 전환 · 줌 수준 감지는 오작동이 잦고 같은 기능을 탭이 더 명확하게 제공
2026-10-12 · M12 · "길게 눌러 삭제" 대신 편집 시트의 `표시 해제` 버튼 · 길게 누르기는 접근성(키보드·스크린리더)에 불리
2026-10-12 · M12 · 나라 한국어 이름은 Intl.DisplayNames(ko) 사용 · 이름 표를 따로 유지하지 않기 위해, 숫자→알파2 매핑은 i18n-iso-countries로 1회 생성해 src/data에 고정
2026-10-12 · M12 · 지리 데이터 출처·라이선스는 public/geo/README.md에 기록(world-atlas ISC, KOSTAT 2013 "Free to share or remix") · 상업 배포 시 재확인 필요
2026-10-12 · M12 · 새 의존성 react-simple-maps@3(React 18 유지, SPEC 지정), topojson-client·d3-geo(센트로이드/지리 변환), @types/*(dev)
2026-10-12 · M13 · 마법사 답변과 mustInclude는 trips.planning_prefs에 저장하고, 요청의 mustInclude는 본문으로도 전달 · 저장은 이후 호출 컨텍스트용, 본문은 이번 요청 강제용
2026-10-12 · M13 · PlanningPrefs를 supabase/functions/_shared/prefs.ts로 두고 앱은 재export · AI 스키마와 같은 이유(Deno·앱 단일 출처), 모든 필드 nullish로 구조화 출력 스키마와 호환
2026-10-12 · M13 · 수동 입력 장소의 saved_places 키는 `manual:정규화이름` · google_place_id가 NOT NULL+유니크라 Google 키 없이도 중복 저장 방지
2026-10-12 · M14 · country-info는 확신 있는 필드만 채우고 verifiedAt=null · SPEC이 "공식 출처 확인 + 불확실하면 비움"을 요구하나 무인 모드에서 공식 출처 대조를 못 해 사람 확인 항목(HUMAN_TODO)으로 남김
2026-10-12 · M14 · 환율 오프라인 값은 IndexedDB 대신 localStorage(lib/fx.ts) 유지 · 값이 통화당 수십 바이트라 충분, M17 영속화 단계에서 통합 여부 재검토
2026-10-12 · M14 · 비자·입국은 서술 없이 외교부 해외안전여행 + 검색 링크만 · CLAUDE.md 알려진 주의점 · 대사관 URL은 확신이 없어 검색 링크로 대체
2026-10-12 · M14 · 날씨 규칙: 과거 여행=아카이브 실측, 16일 창 안=예보(창 밖 날짜는 생략), 그 밖=작년 같은 기간 아카이브(예보 아님 명시) · Open-Meteo 실호출로 파라미터 확인(아카이브는 강수확률 null)
2026-10-12 · M15 · 주변 장소 찾기는 Google 지도 검색 링크(키 불필요)로 구현 · F-3-10 지도 근처 보기는 Maps 키가 필요해 BACKLOG로 두고 홈에서는 링크 칩만 제공
2026-10-12 · M15 · 기사님께 보여주기는 저장된 이름·주소를 큰 글씨로 표시, 현지어 이름은 Places 키 이후(M17 오프라인 카드와 함께) · 키 없이 가능한 범위까지만
2026-10-12 · M15 · 전/중/후 판정은 목적지(첫 목적지의 대표 시간대, 없으면 기기 시간대) 현지 날짜 기준 · SPEC F-3-9, 시차로 하루 어긋나는 케이스 테스트 포함
2026-10-12 · M16 · 캡처 이미지는 receipts 버킷에 `resv-` 임시 파일로 올리고 함수가 읽은 직후 삭제(성공·실패 모두) · SPEC "처리 후 삭제", 별도 버킷 없이 기존 정책 재사용
2026-10-12 · M16 · ai-reservation은 붙여넣은 원문을 저장·로그하지 않고 오류는 코드/zod 경로만 기록 · SPEC 개인정보 규칙, 프롬프트에 "문서 안 지시 무시" 명시(식당 샘플의 지시문 삽입 시험 통과)
2026-10-12 · M16 · runAi가 429/5xx에서 0.8초 대기 후 재시도 · 실호출 12회 중 3회 일시 실패가 있어 보강(4xx는 재시도 안 함)
2026-10-12 · M17 · 쓰기 큐는 체크리스트 토글·지출 추가(영수증 제외)·장소 메모만, 같은 대상의 연속 쓰기는 마지막 것으로 합침 · SPEC F-3-4 제한 범위, save_expense/update가 id 기준이라 재시도해도 중복 없음
2026-10-12 · M17 · 서버가 거절한 큐 항목은 그 항목만 버리고 사용자에게 알림, 네트워크 오류는 순서를 지키며 멈춤 · 큐 하나가 영구히 막히는 것을 방지
2026-10-12 · M17 · 날씨 쿼리는 Map을 담고 있어 영속화에서 제외, 채팅/AI 상태/초대/발자취/내 저장도 제외 · 직렬화 불가 + SPEC "여행 관련 쿼리만"
2026-10-12 · M17 · 오프라인 시작 시 세션은 localStorage의 저장된 Supabase 세션 user id로 대체 · 갱신 실패해도 캐시된 여행을 열 수 있게(UNVERIFIED: 실제 비행기 모드)
2026-10-12 · M17 · 새 의존성 idb-keyval, @tanstack/react-query-persist-client, @tanstack/query-async-storage-persister(쿼리 영속화·큐 저장, SPEC F-3-4 지정)
2026-10-12 · M18 · 읽기 전용 링크는 익명 세션이 자동 생성되는 SPA 라우트(/v/:token)로 구현 · 앱 전체가 SessionGate를 쓰므로 "로그인 없이" 충족, noindex meta는 라우트 진입 시 head에 주입
2026-10-12 · M18 · OG 미리보기 태그는 SPA라 서버 렌더 없이 불가 → BACKLOG(배포 단계에서 엣지 함수/프리렌더 필요)
2026-10-12 · M18 · runAi 실패 메시지에 제공자별 원인을 모두 기록(키·문서 내용은 제외) · 마지막 제공자(OpenRouter 402)가 실제 원인(Gemini 429)을 가려서 진단이 어려웠음
2026-10-12 · M18 · 회고 프롬프트는 장소·평점·후기 코멘트만 전달(금액·확인번호·멤버 이름/ID 제외), 후기 코멘트는 사용자 작성 텍스트라 개인정보가 있을 수 있어 HUMAN_TODO에 점검 항목
2026-10-12 · M19 · 라우트 단위 lazy 로드로 첫 로드 JS 683KB → 103KB(gzip 32KB) · SPEC 규칙 12, 큰 화면은 필요할 때만 받음
2026-10-12 · M19 · eslint-plugin-jsx-a11y 추가(devDependency) · 접근성 규칙을 CI 린트로 고정, 시트 안 autoFocus는 dialog 기본 포커스에 맡기고 인라인 편집만 예외 주석
2026-10-12 · M19 · 영속 캐시 복원 직후 전체 쿼리 무효화 · 복원된 데이터는 타임스탬프가 신선해도 몇 시간 전 값일 수 있어, 새로고침 후 방금 입장한 동행이 안 보이던 버그를 Playwright가 찾아 수정
2026-10-12 · M19 · @playwright/test 추가(devDependency), 설치된 Chrome(channel chrome) 사용 · 브라우저 다운로드 없이 스모크 실행
