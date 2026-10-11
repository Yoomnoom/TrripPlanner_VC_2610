# 개인용 여행 플래너 — 구축 명세서 (Claude Code용)

> 이 문서는 Claude Code가 이 프로젝트를 처음부터 끝까지 만들 수 있도록 작성한 단일 기준 문서입니다.
> 기준 레퍼런스: 20가지 여행 기능을 소개하는 릴스 화면 녹화 영상(5분, 같은 내용 반복). 영상에서 확인된 기능은 전부 포함하고, 영상에 안쪽 화면이 없던 항목은 "가정"으로 표시했습니다.
> 작업 원칙은 6부(구현 단계)와 부록 A(작업 규칙)를 따릅니다.
> **부록 F(트리플 벤치마크 접목)는 본문을 보완·확장하며, 본문과 충돌하면 부록 F가 우선합니다.**

---

## 0. 프로젝트 개요

- **이름(가칭):** Trip Planner (앱 내 표기 이름은 설정에서 바꿀 수 있게 상수로 분리)
- **목적:** 개인과 친구 몇 명이 같이 쓰는 여행 플래너. AI가 일정을 짜 주고, 지도·캘린더로 다듬고, 여행 중에는 비용을 기록·정산하며, 다녀온 곳은 발자취 지도에 쌓는다.
- **사용자 규모:** 소규모(여행당 2~8명). 상용 서비스 아님. 비용 최소화가 우선.
- **형태:** 모바일+PC 반응형 웹앱 (PWA 설치 가능하게).
- **참여 방식:** 로그인 없음. 초대 링크로 입장하고 닉네임만 입력.
- **AI:** Gemini API 또는 OpenRouter를 설정에서 선택. 키는 서버에만 둔다.
- **지도·장소·경로:** Google Maps Platform.
- **UI 언어:** 한국어 전용. 코드·변수명·커밋 메시지는 영어.

### 비목표 (만들지 않는 것)
- 이메일/소셜 로그인, 결제, 푸시 알림, 네이티브 앱, 다국어 UI
- 항공권·숙소 예약 연동 (예약 메뉴는 "내가 기록하는 곳"일 뿐)
- 인스타그램 릴스 크롤링·임베드 (영상의 "이 지역 릴스"는 외부 검색 링크로 대체)

---

## 1. 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 플랫폼 | 반응형 웹앱 (PWA) |
| 프론트엔드 | React 18 + TypeScript(strict) + Vite |
| 백엔드 | Supabase (Postgres, Realtime, Storage, Edge Functions, 익명 인증) |
| 참여/인증 | Supabase 익명 로그인 + 초대 토큰 + 닉네임 |
| AI | Gemini API / OpenRouter 둘 다 지원, 설정에서 전환, 실패 시 자동 전환 옵션 |
| 지도 | Google Maps JavaScript API, Places API (New), Routes API |
| 캘린더 | FullCalendar (timeGrid + interaction) |
| 차트 | Recharts |
| 발자취 지도 | react-simple-maps + TopoJSON (세계), GeoJSON (한국 시·군). **React 18 고정**(react-simple-maps는 React 19를 지원하지 않을 수 있으므로 버전 호환을 설치 시 확인) |
| 스타일 | Tailwind CSS + shadcn/ui 컴포넌트 일부 |
| 서버 상태 | TanStack Query + Supabase Realtime 구독 |
| 클라이언트 상태 | Zustand (UI 상태만) |
| 검증 | zod (클라이언트·Edge Function 공용 스키마) |
| 날짜 | date-fns (+ date-fns-tz 불필요, 여행 시간은 "현지 벽시계 시간"으로 저장) |
| 패키지 매니저 | pnpm |
| 배포 | 프론트는 Vercel 또는 Cloudflare Pages, 백엔드는 Supabase |

---

## 2. 저장소 구조

```
trip-planner/
├─ CLAUDE.md                      # Claude Code 작업 지침 (부록 A 내용 요약)
├─ docs/SPEC.md                   # 이 문서
├─ .env.example
├─ package.json
├─ vite.config.ts
├─ index.html
├─ public/
│  ├─ geo/
│  │  ├─ world-110m.json          # world-atlas countries-110m TopoJSON
│  │  └─ kr-municipalities.json   # 한국 시·군·구 GeoJSON/TopoJSON
│  ├─ manifest.webmanifest
│  └─ icons/
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ router.tsx
│  │  ├─ providers.tsx            # QueryClient, Supabase session bootstrap, Maps loader
│  │  └─ layout/                  # MobileShell, DesktopShell, BottomTabs, Sidebar
│  ├─ lib/
│  │  ├─ supabase.ts
│  │  ├─ maps.ts                  # Google Maps 로더, 헬퍼
│  │  ├─ time.ts                  # "HH:mm" 파싱/포맷, 구간 겹침 계산
│  │  ├─ geo.ts                   # haversine, 좌표 유틸
│  │  ├─ money.ts                 # 통화 소수 자리, 포맷, 환산
│  │  ├─ settlement.ts            # 정산 알고리즘 (순수 함수, 테스트 필수)
│  │  ├─ csv.ts
│  │  └─ ids.ts
│  ├─ schemas/                    # zod 스키마 (ai.ts, trip.ts, expense.ts ...)
│  ├─ types/db.ts                 # supabase gen types 결과
│  ├─ features/
│  │  ├─ trips/                   # 목록, 생성, 홈 대시보드
│  │  ├─ join/                    # /join/:token
│  │  ├─ chat/                    # AI 채팅
│  │  ├─ itinerary/               # 리스트 뷰, 시간 변경 팝업, 실내 대체
│  │  ├─ calendar/
│  │  ├─ map/
│  │  ├─ explore/                 # 장소 탐색, 아이디어 보관함
│  │  ├─ reservations/
│  │  ├─ files/
│  │  ├─ checklist/
│  │  ├─ expenses/                # 목록, 폼, 차트, 영수증, 정산
│  │  ├─ members/                 # 동행, 공유 관리
│  │  ├─ footprints/              # 발자취
│  │  └─ settings/                # AI 설정, 데이터 내보내기
│  └─ components/ui/              # 공용 UI (Button, Sheet, Dialog, Tabs, Card, Gauge ...)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                 # 0001~0003 (이미 작성·검증됨, 수정 금지)
│  ├─ tests/                      # rls_smoke.sql, stub_supabase.sql, README.md
│  ├─ seed.sql                    # 개발용 도쿄 3박4일 샘플
│  └─ functions/
│     ├─ _shared/                 # cors.ts, auth.ts, zod 스키마, ai/ 어댑터
│     ├─ ai-plan/index.ts
│     ├─ ai-receipt/index.ts
│     ├─ ai-indoor-swap/index.ts
│     ├─ routes-leg/index.ts
│     └─ fx-rate/index.ts
└─ tests/                         # vitest 단위 테스트, playwright 스모크
```

패키지로 전달된 파일 중 `supabase/`(마이그레이션과 권한 스모크 테스트)와 `starter/`(검증된 순수 로직 코드)는 이미 완성본이다. `starter/`는 M0에서 `src/`로 옮긴다.

---

## 3. 참여 모델과 데이터베이스

### 3-1. 인증·참여 흐름

1. 앱 최초 실행 시 `supabase.auth.signInAnonymously()`로 익명 세션을 만든다. (대시보드에서 Anonymous sign-ins 활성화 필요)
2. **여행 만들기:** RPC `create_trip(...)` → trips 행 생성 + 만든 사람을 `owner` 멤버로 등록 + 초대 토큰 발급.
3. **입장:** `/join/:token` → 닉네임 입력 → RPC `join_trip(token, nickname)` → members 행 생성 → `/t/:tripId`로 이동.
4. 닉네임은 여행별로 다를 수 있다 (members.nickname). 기기에서 마지막으로 쓴 닉네임을 입력 기본값으로 제안한다.
5. 익명 세션이 사라지면(브라우저 데이터 삭제) 그 기기의 멤버 자격도 사라진다. 대응책:
   - 같은 초대 링크로 재입장 시 "내가 쓰던 닉네임으로 다시 들어오기"를 제공한다. 닉네임이 기존 멤버와 같으면 새 멤버를 만들지 않고 **기존 멤버의 user_id를 현재 세션으로 교체**한다. (소규모 신뢰 기반 앱이므로 허용. 설정 화면에 안내 문구 표시)
   - 설정에서 "내 데이터 내보내기(JSON)"와 "가져오기"를 제공한다 (발자취 보존용).
6. 권한은 2종류: `owner`(여행 삭제, 공유 중지, 멤버 제거, 토큰 재발급), `member`(그 외 전부 읽기/쓰기).

### 3-2. 스키마

**전체 스키마는 `supabase/migrations/`에 이미 작성되어 있고, 임시 Postgres 16에서 적용과 권한 동작(아래 3-3의 규칙)을 검증했다.** M1의 작업은 이 파일들을 Supabase에 **적용하고 다시 검증하는 것**이며, 스키마를 새로 쓰지 않는다. 변경이 필요하면 새 마이그레이션(0004…)을 추가한다.

| 파일 | 내용 |
|---|---|
| `0001_init.sql` | 핵심 테이블, RLS, 권한 헬퍼, RPC, Realtime |
| `0002_triple_features.sql` | 후기, 내 저장, 읽기 전용 공유, 여행 복제 (부록 F) |
| `0003_storage.sql` | Storage 버킷 3개와 정책 |

테이블 개요:

| 테이블 | 용도 |
|---|---|
| `trips` | 여행(제목, 날짜, 초대 토큰, AI 설정, 취향/회고 jsonb) |
| `trip_destinations` | 여행 목적지(나라 코드, 도시, 좌표) |
| `members` | 여행 참여자(익명 user_id, 닉네임, 역할, 색) |
| `places` | 일정과 아이디어 통합. `day_index` null = 아이디어 보관함. 이동 정보 캐시(`leg_*`) 포함 |
| `reservations`, `trip_files` | 예약, 자료(파일/링크) |
| `checklist_items` | 체크리스트(section: before/packing) |
| `expenses`, `expense_splits` | 지출과 분담(KRW). 원 통화, 고정 환율, 원화 환산액 |
| `settlements` | 정산 완료 기록 |
| `chat_messages` | AI 채팅 기록과 제안(proposal) |
| `footprints` | 발자취(개인 소유) |
| `api_usage` | API 일일 사용량(서비스 전용) |
| `place_reviews`, `place_photos`, `saved_places` | 후기, 후기 사진, 내 저장 (0002) |

### 3-3. 권한 규칙 (RLS·컬럼 권한) — 구현과 테스트의 기준

1. 모든 테이블 RLS 활성. `anon` 역할에는 어떤 테이블 권한도 없다. 익명 로그인 사용자는 `authenticated` 역할이다.
2. 멤버십 판정은 `is_trip_member(trip_id)`, `is_trip_owner(trip_id)`, `is_me(member_id)` (모두 security definer).
3. **컬럼 단위 권한으로 권한 상승을 막는다.** `trips`는 일부 컬럼만 update 가능(`invite_token`, `view_token`, `created_by` 수정 불가). `members`는 `nickname`, `color`만 update 가능(`role` 변경 불가). `trips`/`members` 직접 insert 불가 — RPC로만 생성.
4. **지출 쓰기는 RPC 전용:** `expenses`, `expense_splits`는 직접 insert/update 불가, 조회와 expense 삭제만 가능. 저장은 `save_expense`.
5. `chat_messages`: 클라이언트는 조회와 `proposal_applied` 수정만. 행 생성은 Edge Function(service_role).
6. `api_usage`: service_role 전용. 클라이언트 접근 불가.
7. 읽기 전용 공유(`view_token`) 보유자는 anon이든 아니든 `get_shared_trip` 외 어떤 테이블도 읽을 수 없다.
8. 멤버를 참조하는 FK(`paid_by`, `expense_splits.member_id`, `settlements.from/to`)는 `deferrable initially deferred`: 지불·분담·정산 기록이 있는 멤버는 삭제가 거부되지만, 여행 삭제(연쇄 삭제)는 허용된다.
9. 초대 토큰 재연결(3-1의 5번)은 신뢰 기반 설계임을 설정 화면에 안내한다.

### 3-4. RPC (모두 security definer)

| 함수 | 용도 |
|---|---|
| `create_trip(p_title, p_start, p_end, p_nickname, p_destinations jsonb)` → uuid | 여행 + owner 멤버 + 목적지 + 초대 토큰 생성 |
| `join_trip(p_token, p_nickname)` → uuid | 토큰 검증 후 입장. 같은 닉네임이 있으면 기존 멤버에 재연결 |
| `peek_invite(p_token)` | 입장 전 제목·날짜·인원수 미리보기 |
| `set_invite(p_trip, p_enabled)` → text | 초대 링크 켜기(새 토큰)/끄기(null). 소유자만 |
| `save_expense(p_trip, p_id, p_data jsonb, p_splits jsonb)` → uuid | 지출 생성/수정 (아래 설명) |
| `bump_usage(p_user, p_kind, p_limit)` → boolean | 일일 호출 한도 카운트. **service_role만 실행 가능** |
| `set_view_link(p_trip, p_enabled)` → text | 읽기 전용 링크 켜기/끄기. 소유자만 (0002) |
| `get_shared_trip(p_token)` → jsonb | 읽기 전용 페이지용 스냅샷. anon 실행 가능 (0002) |
| `duplicate_trip(p_src, p_title, p_start, p_nickname, p_checklist)` → uuid | 내 여행 복제 (0002) |
| `import_shared_trip(p_view_token, p_title, p_start, p_nickname)` → uuid | 읽기 전용 링크에서 일정 가져오기 (0002) |

**`save_expense` 페이로드**
- `p_data`: `{ day_index, spent_on, title, category, amount, currency, exchange_rate, amount_krw, payment_method, paid_by, place_id, place_label, memo, receipt_path }`
- `p_splits`: `[{ member_id, share_krw }, ...]`
- DB가 검증한다: 분담 합계 = `amount_krw`, `amount_krw ≈ round(amount × exchange_rate)`(±1원), 결제자와 분담자는 모두 같은 여행 멤버.
- `p_id`를 클라이언트가 UUID로 만들어 보내면 재시도해도 중복 저장되지 않는다(멱등). 오프라인 쓰기 큐(F-3-4)는 이 성질을 이용한다.
- 클라이언트 오류 메시지는 한국어로 바꿔서 보여준다(예: 분담 합계 불일치 → "분담 금액의 합이 지출 금액과 달라요").

### 3-5. Realtime / Storage

- Realtime: 핵심 테이블은 `0001`, 후기 테이블은 `0002`에서 `supabase_realtime` publication에 추가했고, 삭제 이벤트에서도 `trip_id`를 받도록 `replica identity full`을 설정했다. 클라이언트는 INSERT/UPDATE를 `trip_id` 필터로 구독하고, DELETE는 `id`로 캐시에서 제거한다.
- Storage(`0003`): 버킷 3개, 모두 private.
  - `trip-files` — 자료. 경로 `{trip_id}/{uuid}-{filename}`, 20MB
  - `receipts` — 영수증. 경로 `{trip_id}/{expense_id or uuid}.jpg`, 5MB
  - `place-photos` — 후기 사진. 경로 `{trip_id}/{uuid}.jpg`, 5MB
- 정책: 경로 첫 세그먼트를 trip_id로 해석해 멤버만 읽기/쓰기/삭제. 첫 세그먼트가 uuid가 아니면 접근 거부.
- 파일 접근은 서명 URL(유효 1시간)로만. 업로드 전 이미지는 클라이언트에서 긴 변 1600px, JPEG 품질 0.8로 리사이즈한다.

---

## 4. 화면과 기능 상세

### 4-0. 라우팅

| 경로 | 화면 |
|---|---|
| `/` | 내 여행 목록 (내가 멤버인 trips), "새 여행", 발자취 바로가기 |
| `/new` | 여행 만들기 |
| `/join/:token` | 초대 입장 (여행 제목·날짜 미리보기 + 닉네임 입력) |
| `/t/:tripId` | 여행 홈 (대시보드) |
| `/t/:tripId/chat` | AI 채팅 |
| `/t/:tripId/plan` | 일정 (탭: 리스트 / 캘린더 / 지도) |
| `/t/:tripId/explore` | 장소 탐색 + 아이디어 보관함 |
| `/t/:tripId/reservations` | 예약 |
| `/t/:tripId/files` | 자료 |
| `/t/:tripId/checklist` | 체크리스트 |
| `/t/:tripId/expenses` | 비용 (탭: 요약 / 목록 / 정산) |
| `/t/:tripId/members` | 동행·공유 |
| `/footprints` | 발자취 (여행과 무관한 개인 화면) |
| `/settings` | 앱 설정, 데이터 내보내기/가져오기 |

- 모바일: 하단 탭 5개 — **홈 / 일정 / 채팅 / 비용 / 더보기**(탐색·예약·자료·체크리스트·동행·발자취·설정).
- 데스크톱(≥1024px): 좌측 사이드바(전체 메뉴) + 메인 영역. 일정 화면은 좌측 리스트/캘린더 + 우측 지도 분할.
- 모든 화면에 로딩 스켈레톤, 빈 상태(일러스트 대신 아이콘+한 줄 안내+기본 행동 버튼), 에러 상태(재시도 버튼)를 만든다.

### 4-1. 여행 만들기 (`/new`)

- 입력: 여행 제목, 시작일·종료일(날짜 범위 선택), 목적지(나라 + 도시 검색, 복수 가능), 내 닉네임, 인원(선택), 예산(선택).
- 도시 검색은 Places Autocomplete(`types: ['(cities)']`)로 하고, 결과에서 country_code·lat·lng를 저장한다.
- 제목 기본값은 "{도시} {N}박 {N+1}일 여행".
- 제출 → `create_trip` RPC → `/t/:id`로 이동하고 초대 링크 복사 안내 토스트를 띄운다.

### 4-2. 여행 홈 (대시보드) — 영상: "여행 3박 4일 / 장소 24곳 / D-24 / 준비율"

- 상단 **히어로 카드**(어두운 배경): 제목, 날짜 범위("10월 9일 ~ 10월 12일"), 장소 수 배지("장소 24곳"), 우측에 동행 아바타 스택 + `동행 초대` 버튼, 공유 아이콘(`navigator.share`, 미지원 시 링크 복사).
- **D-day 카드:** 출발 전이면 `D-{n}`, 여행 중이면 `Day {k}/{N}`, 끝났으면 `여행 완료`.
- **준비율 게이지 2개(원형, 영상의 67%):**
  - 전체 준비율 = 체크된 체크리스트 / 전체 체크리스트
  - 출발 전 준비율 = section='before'만
- **메뉴 카드 그리드(2열):** 아이디어(n곳), 일정(n곳), 예약(n건), 자료(n건), 비용(n건), 캘린더(n일), 체크리스트(n/m), 동행(n명). 카드 탭 시 해당 화면으로 이동, 우측 상단에 개수 배지.
- 하단: 미니 지도(일정 핀 요약)와 "오늘의 일정"(여행 중일 때 오늘 Day의 다음 일정 3개).
- 준비물 미리보기 카드(영상의 체크 가능한 준비물 목록 일부 노출): 체크박스를 홈에서 바로 토글할 수 있다.

### 4-3. AI 채팅 (`/chat`)

영상: "도쿄 3박 4일 맛집과 산책 일정 짜줘" 입력 → 일차별 요약 + `일정 보기` 버튼 + 추천 칩.

- 화면: 메시지 목록 + 하단 입력창(`+` 버튼은 이미지 첨부, 전송 버튼 보라색 원형).
- 첫 진입 시 안내 메시지(assistant): "안녕하세요! 여행에 대해 무엇이든 물어보세요. 날씨·환율·비자 같은 궁금한 점도, '도쿄 3박4일 짜줘' 하면 일정까지 바로 만들어 드려요." (문구는 상수)
- 추천 칩 4개: "도쿄 6일 날씨 어때?", "엔화 환율 얼마야?", "도쿄 3박4일 맛집투어 짜줘", "오사카 2박3일 일정 짜줘". 칩은 탭하면 입력창에 채우고 즉시 전송.
- 사용자가 일정 생성을 요청하면 서버(`ai-plan`)가 **제안(proposal)** JSON을 반환한다. 채팅에는 일차별 한 줄 요약(1일차 아사쿠사 아침 식사 · 센소지 산책 …)과 버튼 2개를 보여준다:
  - `일정 보기`: 제안을 임시 미리보기(지도+리스트)로 연다. 이 단계에서는 DB에 쓰지 않는다.
  - `일정에 적용`: 미리보기 확정. 기존 일정이 있으면 "덮어쓰기 / 뒤에 추가 / 취소" 선택 다이얼로그를 먼저 띄운다.
- 기존 일정 수정 요청("2일차 실내 위주로 바꿔줘")은 현재 일정 전체를 컨텍스트로 보내 새 proposal을 받고, **변경 diff(추가/삭제/이동)** 를 요약해서 보여준 뒤 적용한다.
- 영수증 사진을 채팅에 올리면 `ai-receipt`로 보내지 않고, "비용 화면에서 영수증으로 추가하세요" 링크 버튼만 안내한다 (경로 혼동 방지).
- 메시지는 chat_messages에 저장하고 Realtime으로 동행에게도 보인다 (같은 대화를 같이 본다). 보낸 사람 닉네임 표시.
- AI 호출 중에는 "장소를 고르는 중…" 스트리밍 느낌의 진행 표시(영상의 "장소를 고르는 중") 를 보여준다. 스트리밍은 구현하지 않아도 되고, 로딩 문구 3개를 순환 표시한다.
- 오류: AI 실패 시 "지금은 일정을 만들지 못했어요. 다시 시도하거나 설정에서 다른 AI를 선택해 보세요" + 재시도 버튼.

### 4-4. 일정 — 리스트 뷰

영상: Day별 접기/펼치기, 장소 카드(사진·이름·시간·카테고리), 카드 사이 이동 정보 칩("23분 · 1.4km"), 장소 추가.

- Day 섹션 헤더: `Day 1 · 도쿄 1일차 · 10월 9일(금)`, 장소 수, 접기/펼치기 chevron. 오늘 해당하는 Day는 강조.
- 장소 카드: 썸네일(Places 사진, 없으면 카테고리 아이콘), 시간 범위, 이름, 카테고리 칩, 메모 아이콘, `⋮` 메뉴(시간 변경 / 다른 날로 이동 / 아이디어로 보내기 / 메모 / 삭제).
- 카드 사이에 **이동 칩**: 모드 아이콘(도보/대중교통/자동차) + "23분 1.4km". 탭하면 모드 변경(도보↔대중교통↔자동차) → 경로 재계산. 추정치면 `~` 접두("~23분").
- 드래그로 순서 변경(@dnd-kit/sortable, 핸들 아이콘 길게 누름). 다른 Day로 드래그도 허용.
- **순서 변경 후 재배치 규칙(reflow):** 같은 날의 장소는 `시작 시간` 오름차순이 정렬 기준이다. 순서를 바꾸면 각 장소의 **소요 시간(end-start)은 유지**하고, 첫 장소의 시작 시간을 기준으로 이동 시간(없으면 15분)을 사이에 넣어 순서대로 다시 배치한다. 재배치가 일어나면 토스트로 "시간을 다시 배치했어요 · 되돌리기"(Undo 5초)를 보여준다.
- Day 하단 `+ 추가` 버튼 → 장소 추가 시트 (검색 / 아이디어 보관함에서 선택 / 직접 입력).
- **실내 장소로 바꾸기 토글** (Day 헤더 우측, 영상의 보라색 스위치):
  - ON → 해당 Day의 `is_indoor=false`(또는 야외 카테고리) 장소마다 "실내 대안" 칩 표시. 칩을 누르면 `ai-indoor-swap`이 같은 지역의 실내 장소 3곳을 제안하고 `교체` 버튼으로 바꾼다.
  - 비 오는 날 대비 기능이므로 날씨 연동은 하지 않는다 (수동 토글).
  - OFF → 칩 숨김(이미 교체한 것은 그대로).

#### 시간 변경 팝업 (영상 확인됨)
- 필드: 장소명(읽기 전용), 일차(Day 선택), 시작 시간, 종료 시간(또는 소요 시간 스테퍼, 15분 단위). `확인` 버튼.
- 종료 ≤ 시작이면 오류 메시지. 같은 날 겹침은 경고만 표시하고 저장은 허용.
- 저장 시 해당 장소의 이동 정보 캐시를 무효화하고 필요 시 재계산 요청.

### 4-5. 일정 — 캘린더 뷰

영상: 시간표(7AM~), Day 1~4 열, 색상 블록, 드래그 시 툴팁에 시간 표시, 상단 `+ CSV`(내보내기) 보이는 화면도 있음.

- **FullCalendar** `@fullcalendar/react`, `timeGrid`, `interaction`. 가상 날짜가 아니라 실제 trip.start_date + day_index로 변환해서 표시한다.
- 헤더 렌더링을 커스텀해서 `Day 1` + `10월 9일(금)` 두 줄로 표시. 모바일은 한 화면에 2~3일 열만 보이고 가로 스크롤/스와이프. 데스크톱은 전체 일자 표시(최대 7일, 그 이상은 가로 스크롤).
- 시간 범위 기본 07:00~24:00, 슬롯 30분, 스냅 15분. 현재 보이는 범위 밖 일정이 있으면 자동 확장.
- 이벤트 색: 카테고리 색 토큰(7부) 사용. 이벤트 내용: 이름 + 시간 범위.
- 드래그 이동(`eventDrop`), 리사이즈(`eventResize`)로 start/end/day_index 갱신. 드래그 중 툴팁 "Day 2 · 13:30 – 14:00".
- 빈 칸 길게 누르기/클릭(`select`) → 장소 추가 시트(시간 미리 채움).
- 이벤트 클릭 → 장소 상세 시트(수정/삭제/지도에서 보기).
- 영상 하단 `CSV` 버튼: 일정 전체 CSV 내보내기(Day, 시작, 종료, 이름, 카테고리, 주소, 메모).
- 편집 충돌: 같은 이벤트를 두 사람이 동시에 수정하면 마지막 저장 우선(Last Write Wins). 단, Realtime으로 변경을 즉시 반영하고 내가 드래그 중인 이벤트는 건드리지 않는다.

### 4-6. 일정 — 지도 뷰 (영상: 번호 핀, 일자별 색 경로, 현위치/전체화면, Day 탭)

- Google Maps JS(`@vis.gl/react-google-maps`), `mapId` 필수(AdvancedMarker). 스타일은 연한 톤.
- 핀: 번호가 들어간 원형 마커(Day 안의 순서), 색은 **Day 색**(Day 1 보라, Day 2 빨강, Day 3 청록, Day 4 파랑, 이후 순환). 선택 시 확대 + 인포카드(이름, 시간, 카테고리, `길찾기`(구글맵 앱 열기)).
- 경로선: Day별 폴리라인. 기본은 장소 간 **직선**(무료), `leg_polyline`이 있으면 실제 경로선으로 그린다. 선 색은 Day 색과 동일.
- 상단 Day 필터 칩: `전체 / Day 1 / Day 2 …`. 전체일 때는 모든 Day를 색으로 구분.
- 우측 컨트롤: `내 위치`(Geolocation, 권한 거부 시 안내), `전체화면`(Fullscreen API 또는 레이아웃 확대), `전체 보기`(fitBounds).
- 지도 핀 길게 누르기 → "이 위치를 장소로 추가"(역지오코딩).
- 아이디어 보관함 장소는 회색 핀(번호 없음)으로 옵션 표시(토글 `아이디어 보기`).
- 리스트/캘린더/지도는 같은 데이터 스토어를 보므로 어느 쪽에서 수정해도 즉시 동기화된다.

### 4-7. 이동 시간·거리 계산

- 계산 대상: 같은 Day 안에서 **시간순으로 인접한 두 장소**(좌표가 둘 다 있을 때).
- 우선순위: ① 캐시(`leg_from_place_id`가 현재 직전 장소와 같고 `leg_mode`가 같으면 재사용) → ② Edge Function `routes-leg`(Google Routes API) → ③ 추정(haversine 직선거리 × 1.3 / 모드별 속도: 도보 4.5km/h, 대중교통 20km/h + 대기 8분, 자동차 30km/h) 후 `leg_estimated=true`.
- **한국 내 구간 주의:** Google Routes는 한국에서 도보·자동차 경로가 제한된다. 응답이 비었거나 실패하면 추정치로 자동 폴백하고 칩에 `~`를 표시한다. 나중에 카카오/네이버/T맵으로 교체할 수 있게 `routes-leg`를 어댑터 구조로 만든다 (`RoutesProvider` 인터페이스: `getLeg(from, to, mode) → {durationS, distanceM, polyline?}`).
- 호출 제한: 일정 일괄 적용 직후 한 번에 호출하지 말고 큐(동시 3개)로 처리, 화면에 보이는 Day부터 계산. 대중교통은 `computeRoutes`에서 경유지를 쓸 수 없으므로 구간별 호출만 한다.

### 4-8. 장소 탐색 (`/explore`)

영상: 도시 검색 → 카테고리 칩(전체/맛집/카페/관광/쇼핑 …) → 인기 장소 카드(사진, 이름, 평점 4.5(184)) → 우측 "이 지역 릴스" 목록 → 카드 우측 `추가`.

- 상단 검색창(Places Text Search, 여행 목적지 좌표로 `locationBias`). 기본 쿼리는 `{도시} 관광지` 등 카테고리 칩에 맞춘 자동 쿼리.
- 카테고리 칩: 전체, 맛집, 카페, 관광, 쇼핑, 액티비티, 숙소. 각각 Places `includedType`/쿼리 매핑을 상수 테이블로 둔다.
- 장소 카드: 사진 1장, 이름, 평점·리뷰 수, 카테고리, 영업 상태(가능하면), 버튼 `+ 일정`(Day 선택 시트) / `★ 아이디어`(보관함에 추가, day_index=null).
- **이 지역 릴스(대체 구현):** 외부 크롤링 없이, 장소 카드/상세에 `인스타그램에서 보기`, `유튜브에서 보기`, `블로그 후기` 링크 버튼을 제공한다 (각각 검색 URL을 새 탭으로). 영상의 릴스 리스트 UI 자체는 만들지 않는다.
- 페이지네이션: 더 보기 버튼. 결과는 TanStack Query로 캐시(메모리, 15분).
- **아이디어 보관함:** `places where day_index is null`. 목록(카드) + `일정에 넣기`(Day 선택) 버튼 + 삭제. 지도 보기 토글. 개수는 홈의 "아이디어" 카드에 표시.
- 장소 상세 시트: 이름, 주소, 평점·리뷰 수, 영업시간, 전화, 웹사이트, 구글맵 열기, 외부 검색 링크. (사진·평점·영업시간은 조회 시 실시간 호출하고 DB에는 `google_place_id`, 이름, 좌표, 주소만 저장한다 — 구글 약관상 콘텐츠 장기 저장 제한 때문)

### 4-9. 예약 (`/reservations`) — 가정

- 영상에는 카드만 보이므로 아래 구조로 만든다. 유형 칩(항공/숙소/교통/식당/티켓/기타), 제목, 일시(시작/종료), 확인번호(탭하면 복사), 장소 연결, URL, 금액, 메모.
- 목록은 시작 일시 순 타임라인. 항목에 파일 첨부(자료와 연결).
- 항공/숙소 유형은 홈의 일정 상단 "고정 일정" 배너로 보여준다(선택 구현).
- 예약에서 `비용으로 추가` 버튼 → 금액·통화가 채워진 지출 폼을 연다.

### 4-10. 자료 (`/files`) — 가정

- 파일 업로드(PDF, 이미지, 문서; 20MB)와 링크 저장. 목록(아이콘, 제목, 크기, 올린 사람, 날짜), 탭하면 서명 URL로 열기/다운로드, 이름 변경, 삭제.
- 예약과 연결 가능(여권 사본은 개인정보이므로 업로드 시 "여행 멤버 전체에게 보입니다" 경고 문구 표시).

### 4-11. 체크리스트 (`/checklist`) — 영상: 출발 전 / 준비물, 진행률, 3/4, 5/7, 취소선

- 두 섹션: `출발 전`(예: 여권 유효기간 확인, 항공권 확인, 숙소 예약 확인, 환전, 보험 확인, 날씨 확인), `준비물`(운전면허증, 신분증, 충전기, 보조배터리, 선크림, 가벼운 겉옷, 카메라 …). 이 기본 목록은 **새 여행 생성 시 템플릿으로 제안**(체크 해제 상태, 사용자가 선택해서 추가).
- 섹션 헤더: 제목, `체크 수/전체 수`(3/4), `+` 버튼(항목 추가 인라인 입력).
- 항목: 체크박스, 제목(체크 시 취소선+흐리게), 누가 체크했는지(작은 아바타), 드래그로 순서 변경, 길게 눌러 이름 수정/삭제.
- 상단에 진행률 게이지(영상의 67%)와 "출발 전 67% / 전체 N%".
- 동시 편집은 Realtime. 체크 토글은 낙관적 업데이트.

### 4-12. 비용 (`/expenses`)

세 탭: **요약 / 목록 / 정산**. 우측 하단 고정 `+ 지출 추가` FAB(영상의 보라색 버튼).

**요약 탭 (영상: 총지출, 보낼 돈, 받을 돈, 도넛, 막대, 큰 지출)**
- 상단 3카드: `보낼 돈`(내가 줘야 할 총액), `받을 돈`(내가 받을 총액), `전체 지출`(₩1,352,500 형식). 정산 완료분은 제외.
- 도넛 1: 카테고리별 비율(교통 38% / 숙박 33% / 식비 21% / 쇼핑 5% / 입장료 3%) — 범례 포함, 중앙에 최대 카테고리.
- 도넛 2: 사용자별 부담(각 멤버의 share 합 비율), 중앙에 최대 부담자 닉네임.
- 막대: 일자별 비용(D1, D2, …). 칩으로 `전체 / 교통 / 숙박 / 식비 / 쇼핑 / 입장료` 필터. 막대 위에 금액 라벨(6.2만 형식, 한국식 축약).
- `큰 지출`: 전체 대비 비율(예: "전체의 68%") + 상위 5개 지출 리스트(아이콘, 이름, 금액, 비율 바).
- 예산이 설정돼 있으면 예산 대비 진행 바 표시.

**목록 탭**
- Day별 그룹(`Day 1 · 10월 9일(금)` 접기 가능), 항목: 카테고리 아이콘, 제목, `카테고리 · 장소 · 결제수단`, 금액(원화), 외화면 작은 글씨로 원 금액.
- 검색창, 필터(카테고리·결제자·결제수단·Day), `CSV` 내보내기 버튼(UTF-8 BOM, 열: 날짜, Day, 제목, 카테고리, 원금액, 통화, 환율, 원화금액, 결제수단, 결제자, 분담 내역).
- 항목 탭 → 상세 시트(수정/삭제/영수증 보기).

**지출 추가/수정 폼 (영상: 상단 "예: 점심 스시 1480엔 카드" 한 줄 입력 + 칩 + `더보기`)**
- **빠른 입력:** 맨 위 텍스트 한 줄에 "점심 스시 1480엔 카드"처럼 입력하면 서버 파서(AI 없이 클라이언트 정규식 우선, 실패 시 무시)가 금액·통화·결제수단·카테고리를 칩으로 채운다. 칩: 금액 `¥1,480 ≈ ₩13,6xx`, 통화 `JPY`, 분류 `식비`, 결제수단 `카드`, 일자 `Day 1`. 칩을 탭하면 수정.
- `더보기` 펼침: 금액, 통화(셀렉트: KRW/JPY/USD/EUR/CNY/THB/VND 등 + 직접 입력), 환율(자동 채움, 수정 가능), 원화 환산액(자동), Day(셀렉트), 카테고리(셀렉트), 결제수단(현금/카드/이체/기타), 결제자(멤버 셀렉트, 기본 나), 장소(일정 장소 선택 또는 직접 입력, 영상의 "영수증 사진으로 자동 입력" 자리), 메모, 영수증 첨부.
- **저장은 반드시 `save_expense` RPC로 한다**(3-4). 클라이언트가 만든 UUID를 `p_id`로 넘기고, 분담 합계가 원화 환산액과 같도록 `splitEqual` 등으로 먼저 계산한다. `expenses`에 직접 insert/update 하지 않는다(권한 없음).
- **분담:** 기본 `전원 균등`. 옵션: 일부 인원만 선택해 균등, 직접 금액 지정, 비율 지정. 합계 불일치 시 저장 불가 + 남은 금액 표시. KRW 정수 반올림 오차는 결제자에게 몰아준다.
- **환율:** `fx-rate` Edge Function이 Frankfurter API(키 불필요)로 `1 통화 = ? KRW`를 가져온다. 하루 단위 캐시. 실패 시 직전 값/수동 입력. 저장 시점의 환율을 `expenses.exchange_rate`에 **고정**한다(나중에 환율이 바뀌어도 과거 지출은 안 변함).
- **영수증 자동 입력:** 폼 상단 `영수증 사진으로 자동 입력` → 파일 선택/카메라 → 리사이즈 → Storage 업로드 → `ai-receipt` 호출 → 결과(상호명, 날짜, 합계, 통화, 분류 추정, 품목)를 폼에 **미리 채우기만** 하고 저장은 사용자가 확인 후 직접. 인식 실패 시 수동 입력 안내.

**정산 탭 (영상: "정산하기 / 인서 → 지우 ₩109,250 / 정산 버튼 / 잔액 +/-")**
- 상단 `정산하기 N`: 최소 송금 횟수 알고리즘 결과를 카드로 표시 ("인서 → 지우 ₩109,250" + `정산` 버튼).
- `정산` 버튼 → 확인 다이얼로그 → settlements 행 추가 → 잔액에서 제외 → 카드는 "정산 완료"로 접힘. 실수 시 `정산 취소`(해당 행 삭제).
- `잔액` 섹션: 멤버별 `+₩109,250`(받을 돈, 검정 바) / `-₩109,250`(줄 돈, 빨강 바).
- 정산 알고리즘은 부록 C-2. 순수 함수로 만들고 vitest로 검증한다.
- 외화 지출도 모두 `amount_krw`와 `share_krw`(KRW) 기준으로 정산한다.

### 4-13. 동행·공유 (`/members`)

- 상단 `초대` 버튼(검은 알약) → **초대 링크 시트**(영상): 링크 입력창(읽기 전용) + `복사` 버튼 + `닫기`. 복사 시 "초대 링크를 복사했어요" 토스트. 링크 형식 `https://{host}/join/{token}`.
- 우측 `공유` 아이콘 → 메뉴: `링크 복사하기`, `공유 중지`(빨강). 공유 중지 → `set_invite(trip, false)`로 토큰 null화, 이미 들어온 멤버는 유지. 다시 켜면 새 토큰 발급(기존 링크는 영구 무효).
- 멤버 목록: 아바타(색 원+이니셜), 닉네임, 역할 배지(소유자), 입장일. 본인은 닉네임·색 수정 가능. 소유자는 멤버 제거 가능(결제·분담·정산 기록이 있는 멤버는 DB가 삭제를 거부하므로 "기록이 있어 삭제할 수 없어요"로 안내).
- 입장 화면(`/join/:token`): `peek_invite`로 제목·날짜·인원수 표시 → 닉네임 입력(1~20자, 중복이면 "같은 닉네임이 있어요. 본인이면 그대로 들어가기") → 입장. 잘못된/중지된 토큰이면 안내 화면.
- Presence: Realtime presence로 지금 보고 있는 멤버를 아바타 스택에 점 표시(선택 구현).

### 4-14. 발자취 (`/footprints`) — 영상: 세계 지도, 보라/주황 색칠, 통계 카드, "가봤어요 / 가보고 싶어요" 팝업

- 여행 안의 탭이 아니라 **독립 화면**으로 만든다 (영상에서는 일정/캘린더/발자취 탭 옆에 보였지만, 발자취는 개인 데이터라 분리). 여행 홈에서도 바로가기를 제공한다.
- 세계 지도(react-simple-maps, Mercator): 나라 탭 → 시트(영상의 "일본 · 여행 안 가본 나라" 팝업) 2개 버튼 `가봤어요` / `가보고 싶어요` + `닫기`.
  - `가봤어요` → status='visited', 보라(#5B3DF5 계열)로 칠함. 시기(연-월) 선택은 선택 사항.
  - `가보고 싶어요` → 팝업 필드: 언제쯤(셀렉트: 시기 미정 / 올해 / 내년 / 직접 선택 `YYYY-MM`), 메모(선택, 예: "스위스 여행") → `추가`. 주황(#F59E0B 계열)으로 칠함.
  - 이미 상태가 있는 나라를 탭하면 상세 시트(상태 변경 / 메모 수정 / 해제).
- 지도 조작: 핀치 줌, 드래그, 더블탭 줌. 한 번에 보이는 라벨은 줌 수준에 따라 조절.
- **대한민국 확대 시** 시·군·구 단위 지도로 전환(`kr-municipalities.json`). 시·군 탭 → 같은 시트(가봤어요/가보고 싶어요)로 `region` 풋프린트 저장. 영상의 "우리나라 모두"(부산·거제 등) 구현 부분.
- 하단 통계 카드(둥근 시트): 탭 `통계 / 가보고 싶은 곳 N`.
  - 통계 지표(영상 순서): **나라 / 여행 / 장소 / 도시 / 일수 / 대륙 / 연 연속**
  - 정의:
    - 나라 = status='visited'인 country 수
    - 여행 = 종료일이 오늘 이전인 내가 속한 trips 수
    - 장소 = 위 여행들의 일정 장소(day_index not null) 수 합
    - 도시 = 위 여행들의 `trip_destinations.city` distinct 수
    - 일수 = 위 여행들의 (end−start+1) 합
    - 대륙 = visited 나라가 속한 대륙 distinct 수 (country→continent 정적 매핑 테이블 `src/lib/continents.ts`)
    - 연 연속 = 여행이 있었던 해가 이어진 최대/현재 연속 연수
- `가보고 싶은 곳` 탭: 위시 목록(나라, 시기, 메모) + 탭하면 편집, 길게 눌러 삭제, "이 여행 만들기" 버튼(해당 나라가 목적지로 채워진 /new로 이동).
- **여행과 자동 연동:** 여행 종료일이 지나면 목적지 나라에 대해 "가봤어요로 표시할까요?" 확인 배너를 발자취 화면 진입 시 한 번 표시한다 (자동 변경 금지).
- 검색창: 나라/도시 이름 검색 → 해당 나라로 지도 이동·확대.

### 4-15. 설정 (`/settings`)

- **AI:** 제공자(Gemini / OpenRouter), 모델 ID(텍스트 입력 + 추천 프리셋 드롭다운), 자동 전환 on/off. 여행 단위 설정(`trips.ai_*`)이지만 설정 화면에서 현재 여행을 골라 바꾼다. `연결 테스트` 버튼(짧은 프롬프트 호출 결과 표시).
- **데이터:** 내 데이터 내보내기(JSON: 참여 여행 목록, 발자취, 닉네임), 가져오기(발자취·닉네임 복원), 로컬 캐시 지우기.
- **정보:** 버전, 사용 중인 지도/AI 제공자 표기, 개인정보 안내(닉네임·여행 데이터는 멤버에게만 공유됨).
- 앱 이름/테마(라이트 고정, 다크는 선택 구현).

---

## 5. 서버 함수 (Supabase Edge Functions)와 외부 API

### 5-0. 공통 규칙

- 런타임은 Deno. 모든 함수는 `_shared/cors.ts`(CORS), `_shared/auth.ts`(요청 JWT로 사용자용 Supabase 클라이언트 생성), `_shared/errors.ts`를 쓴다.
- JWT 검증은 켜 둔다(익명 세션도 JWT가 있음). 함수 안에서 `tripId`가 있으면 **사용자 클라이언트로 trips를 조회**해서 RLS로 멤버십을 확인한다 (조회 안 되면 403).
- 응답 형식: 성공은 `{ data: ... }`, 실패는 `{ error: { code, message } }` + 적절한 HTTP 상태.
- 외부 호출은 타임아웃 40초, AI 호출은 1회 재시도(JSON 파싱/zod 실패 시에만).
- **비용 보호:** Edge Function은 외부 API를 부르기 전에 service_role 클라이언트로 `bump_usage(user_id, kind, limit)`를 호출하고, `false`가 오면 429 + "오늘 사용 한도에 도달했어요"를 반환한다. 기본 한도: AI 60회/일, routes 400회/일, receipt 30회/일(환경변수로 조정, 부록 F의 한도 포함).
- Edge Function에는 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`가 자동으로 주입된다. service_role 클라이언트는 **사용량 카운트와 chat_messages 저장에만** 쓰고, 그 밖의 모든 조회·쓰기는 사용자 JWT 클라이언트로 해서 RLS를 따른다.

### 5-1. AI 어댑터 구조 (`_shared/ai/`)

```ts
// types.ts
export type Provider = 'gemini' | 'openrouter';
export interface AiRequest {
  system: string;
  user: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  images?: { mimeType: string; base64: string }[];
  jsonSchema: object;            // JSON Schema (provider에 구조화 출력으로 전달)
  temperature?: number;          // 기본 0.7, 영수증은 0.1
}
export interface AiClient { call(req: AiRequest, model: string): Promise<string /* raw JSON text */>; }
```

- `gemini.ts` — `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, 헤더 `x-goog-api-key`. `systemInstruction`, `contents`(history + user, 이미지는 `inlineData`), `generationConfig: { responseMimeType: "application/json", responseSchema/responseJsonSchema, temperature }`. 스키마 필드명은 Gemini 문서의 현재 이름을 확인해서 쓴다.
- `openrouter.ts` — `POST https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer`, 선택 헤더 `HTTP-Referer`, `X-Title`. `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. 모델이 구조화 출력을 지원하지 않아 400이 나면 `response_format` 없이 "JSON만 출력" 지시로 1회 재시도. 이미지는 `content: [{type:'text'},{type:'image_url', image_url:{url:'data:image/jpeg;base64,...'}}]`.
- `index.ts` — `runAi({ provider, model, fallback, req, zodSchema })`:
  1. 선택된 제공자 호출 → 문자열에서 코드펜스 제거 → `JSON.parse` → zod 검증.
  2. 실패(네트워크/429/5xx/검증 실패)면 같은 제공자 1회 재시도(검증 실패 시 오류 메시지를 프롬프트에 덧붙여서).
  3. 그래도 실패하고 `fallback=true`이며 반대편 API 키가 있으면 반대편 제공자로 1회 시도(모델은 반대편 기본 모델).
  4. 최종 실패 시 `AI_FAILED` 에러. 어떤 제공자/모델로 성공했는지 응답에 `provider`, `model`로 포함해 chat_messages에 기록.
- 기본 모델은 환경변수 `DEFAULT_GEMINI_MODEL`, `DEFAULT_OPENROUTER_MODEL`(예: `gemini-2.5-flash`, `google/gemini-2.5-flash`). 모델 이름은 바뀌므로 **구현 시 공식 문서에서 현재 이름을 확인**하고 하드코딩하지 않는다.
- API 키가 없는 제공자는 설정 화면에서 선택 불가(비활성)로 보이게 `GET`용 헬스 함수(`ai-status`: 어떤 키가 설정돼 있는지 boolean만 반환)를 둔다.

### 5-2. `ai-plan` — 채팅/일정 생성

입력: `{ tripId, message }` (히스토리는 서버가 chat_messages 최근 12개를 직접 로드)

처리:
1. trip, destinations, 현재 일정(장소 이름·Day·시간·카테고리만 요약), 멤버 수, 인원/예산을 로드해 **컨텍스트 JSON** 구성.
2. 컨텍스트 보강(선택): 메시지에 `환율|엔화|달러|유로` 등이 있으면 `fx-rate` 결과, `날씨|기온|비|우산`이 있고 여행일이 오늘로부터 16일 이내면 Open-Meteo 예보(`https://api.open-meteo.com/v1/forecast`, 키 불필요)를 컨텍스트에 추가. 그 외 날씨/비자 질문은 모르면 모른다고 답하게 한다(프롬프트 규칙).
3. `runAi` 호출. 응답 스키마 `AiPlanResponse`(부록 C-4): `{ reply, intent, itinerary? }`.
4. `itinerary.days[].items[]`의 각 항목을 **Places API (New) Text Search**(서버 키)로 해석한다: `POST https://places.googleapis.com/v1/places:searchText`, 헤더 `X-Goog-Api-Key`, `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.types`, 본문 `{ textQuery: searchQuery, locationBias: { circle: { center, radius: 30000 } }, languageCode: "ko" }`. 동시 5개 제한. 성공하면 `google_place_id, address, lat, lng`를 채우고 `resolved:true`, 실패하면 `resolved:false`(이름만 있는 장소로 저장, UI에 "위치 미확인" 배지).
5. **service_role 클라이언트로** chat_messages에 user/assistant 두 행 저장(assistant에 `proposal` jsonb, `provider`, `model`). `member_id`는 사용자 JWT로 조회한 내 멤버 id.
6. 응답: `{ message, proposal, provider, model }`.

규칙:
- Day 수는 여행 일수와 일치, `dayIndex`는 0부터.
- `intent`가 `chat`이면 itinerary 없음(단순 질의응답).
- `intent`가 `itinerary`면 기존 일정 수정 요청일 때도 **수정 후 전체 일정**을 반환한다(클라이언트가 diff 계산).

### 5-3. `ai-receipt`

입력: `{ tripId, imagePath }` — 서버가 사용자 클라이언트로 Storage에서 이미지를 받아 base64로 변환. 이미지 입력을 못 하는 모델이면 `MODEL_NO_VISION` 에러로 "영수증 인식이 가능한 모델을 선택해 주세요"를 반환.
출력(zod `ReceiptResult`): `{ merchant, date(YYYY-MM-DD|null), total(number), currency(ISO 4217), categoryGuess, items[{name, amount}], confidence(0~1) }`.
클라이언트는 이 값을 폼에 **미리 채우기만** 한다. 영수증 이미지는 보존(receipt_path).

### 5-4. `ai-indoor-swap`

입력: `{ tripId, placeId }` → 해당 장소 주변(좌표 반경)에서 **실내**(박물관·미술관·쇼핑몰·수족관·카페·시장 아케이드 등) 대안 3개를 제안(`{ name, category, searchQuery, reason }`) → Places로 해석 → `{ alternatives: [...] }` 반환. 교체는 클라이언트가 place 행을 update.

### 5-5. `routes-leg`

입력: `{ from:{lat,lng}, to:{lat,lng}, mode:'walk'|'transit'|'drive' }`.
호출: `POST https://routes.googleapis.com/directions/v2:computeRoutes`, 헤더 `X-Goog-Api-Key`, `X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline`, 본문 `{ origin:{location:{latLng}}, destination:{...}, travelMode: 'WALK'|'TRANSIT'|'DRIVE', languageCode:'ko' }`. 응답 `duration`은 `"1380s"` 형식 문자열이므로 파싱한다.
출력: `{ durationS, distanceM, polyline|null, estimated:false }`. 경로가 없으면 `{ estimated:true, ... }`로 haversine 추정치를 서버에서 계산해 반환(클라이언트 공용 `geo.ts`와 같은 공식 사용). `RoutesProvider` 인터페이스로 구현해 다른 제공자로 교체 가능하게 한다.

### 5-6. `fx-rate`

입력: `{ base: 'JPY' }` → Frankfurter(`https://api.frankfurter.dev/v1/latest?base=JPY&symbols=KRW`, 이전 도메인 `api.frankfurter.app`; 현재 주소는 확인) 호출 → `{ rate, date }`. KRW→KRW는 1. 지원하지 않는 통화는 `{ rate:null }`로 반환하고 클라이언트가 수동 입력을 요구한다. 응답에 `Cache-Control: public, max-age=43200`.

### 5-7. 클라이언트에서 직접 쓰는 Google API

- Maps JS + Places(New) 라이브러리: 지도 표시, 도시/장소 자동완성, 장소 상세(사진·평점·영업시간) — **브라우저 키**(HTTP 리퍼러 제한, 사용 API 제한).
- 서버 키(Edge Function 전용)는 Places Text Search·Routes에만 사용하고 API 제한을 건다. 브라우저 키와 서버 키를 **분리**한다.
- Google Cloud에서 **예산 알림**(예: 월 $10 / $30)을 반드시 설정하도록 안내 문서를 README에 포함한다.

---

## 6. 구현 단계 (이 순서대로, 단계마다 커밋)

각 단계는 "완료 조건"을 모두 만족해야 다음으로 넘어간다. 막히면 가정을 문서(`docs/DECISIONS.md`)에 적고 진행하되, 돈이 드는 설정이나 키가 필요한 일은 사용자에게 묻는다.

**M0. 뼈대**
- Vite+React+TS, Tailwind, shadcn/ui, 라우터, ESLint/Prettier, vitest, 절대경로 별칭, `.env.example`, PWA 기본 설정, CLAUDE.md.
- 패키지에 포함된 `starter/`의 `src/`, `tests/`를 프로젝트로 옮긴다(`settlement`, `geo`, `time`, AI zod 스키마, `yearStreak` — 이미 타입체크와 vitest 28개를 통과한 코드). `zod`, `vitest` 의존성을 추가하고 `pnpm test`로 다시 통과시킨다.
- 완료 조건: `pnpm dev` 실행, 빈 화면 라우팅, `pnpm test`/`pnpm lint`/`pnpm typecheck` 통과.

**M1. Supabase 기반**
- `supabase init` 후 `supabase/migrations/0001~0003`을 적용한다(**이미 작성·검증된 파일이므로 수정하지 말 것**). 익명 로그인 활성화 확인, 익명 로그인 부트스트랩 코드, `supabase gen types`.
- `supabase/tests/`의 권한 스모크 테스트(`rls_smoke.sql`)를 로컬 Supabase에서 실행해 기대 결과와 같은지 확인하고, 핵심 항목은 자동화 테스트로 옮긴다.
- 완료 조건: 마이그레이션 3개가 오류 없이 적용, 스모크 테스트의 기대 결과(`supabase/tests/README.md`)와 일치, 앱에서 익명 로그인 후 `create_trip` → `join_trip`(다른 브라우저) 동작.

**M2. 여행 생성·참여·홈**
- /new, /, 초대 링크 시트, /join/:token, 멤버 목록, 공유 중지/재발급, 여행 홈 대시보드(게이지는 체크리스트 완료 후 연결).
- 완료 조건: 브라우저 2개(시크릿 창)로 생성→링크 입장→서로 멤버 목록에 표시. 공유 중지 후 새 입장 불가.

**M3. 일정 CRUD (리스트)**
- 장소 추가(직접 입력/Places 검색), Day 섹션, 시간 변경 팝업, 드래그 정렬+reflow, 삭제, 아이디어↔일정 이동.
- 완료 조건: 한 쪽에서 수정하면 다른 쪽에 1~2초 내 반영(Realtime).

**M4. 지도 뷰 + 이동 정보**
- 번호 핀, Day 색, 직선 경로, Day 필터, 현위치, 전체화면, `routes-leg` + 폴백 추정치, 이동 칩.
- 완료 조건: 일정 순서/시간 변경 시 칩이 갱신. 한국 구간은 `~` 추정치로 표시.

**M5. 캘린더 뷰**
- FullCalendar 연동, 드래그·리사이즈·빈 칸 선택 추가, 일정 CSV 내보내기.
- 완료 조건: 캘린더/리스트/지도가 같은 데이터로 동기화.

**M6. 체크리스트 + 홈 게이지**
- 두 섹션, 템플릿 제안, 진행률 게이지, 홈 미리보기.

**M7. 비용 기본**
- 지출 폼(빠른 입력 칩, 더보기), 환율 `fx-rate`, 분담 UI, 목록(검색·필터·CSV), 요약 탭(도넛 2개, 막대, 큰 지출).
- 완료 조건: `splitEqual`, 합계 불변식 vitest 통과. 외화 지출이 환율 고정으로 저장.

**M8. 정산**
- 잔액 계산, 최소 송금 목록, 정산 완료/취소, 보낼 돈/받을 돈 카드.
- 완료 조건: 부록 C-2 테스트 케이스 전부 통과.

**M9. AI 채팅 (서버)**
- `_shared/ai` 어댑터 2종 + 폴백, `ai-status`, `ai-plan`, 채팅 UI, 제안 미리보기·적용(덮어쓰기/추가), 수정 요청 diff, 설정 화면의 AI 선택·연결 테스트.
- 완료 조건: Gemini/OpenRouter 각각으로 "도쿄 3박4일 맛집과 산책 일정"이 위치 해석까지 되어 적용됨. 키 한쪽을 지우면 자동 전환 확인.

**M10. 장소 탐색 + 실내 대체**
- /explore(검색·카테고리·카드·상세·외부 검색 링크), 아이디어 보관함, `ai-indoor-swap`과 토글 UI.

**M11. 영수증 + 예약·자료**
- `ai-receipt`, 영수증 업로드 UX, 예약 CRUD, 자료 업로드/링크, 예약→비용 연결.

**M12. 발자취**
- 세계 지도, 한국 시·군 지도, 가봤어요/가보고 싶어요 팝업·시트, 통계 7종, 여행 종료 후 제안 배너, 데이터 내보내기/가져오기.
- 지리 데이터 파일은 직접 내려받아 `public/geo`에 넣는다 (world-atlas의 `countries-110m.json`, 한국 시·군·구 경계는 공개 GeoJSON 중 라이선스 확인된 것). 출처·라이선스를 README에 기록.

**M13. 마감** (※ 부록 F-6을 적용하면 이 단계는 **M19**로 옮긴다)
- 접근성(포커스, 레이블, 대비), 빈/오류 상태 점검, PWA 설치·아이콘, 성능(코드 스플리팅: 발자취/캘린더/차트 lazy), README(설정 가이드), Playwright 스모크 1~2개, 배포 설정.
- 완료 조건: 모바일(375px)·데스크톱(1280px) 핵심 플로우 수동 점검 체크리스트 통과.

---

## 7. 디자인 시스템

영상의 톤: **밝은 오프화이트 배경, 흰 둥근 카드, 보라색 포인트, 파스텔 카테고리 색, 어두운 히어로 카드**.

### 7-1. 토큰 (Tailwind theme.extend로 정의)

| 토큰 | 값 | 용도 |
|---|---|---|
| `bg` | `#F6F6F9` | 앱 배경 |
| `surface` | `#FFFFFF` | 카드 |
| `ink` | `#1A1A24` | 본문 |
| `muted` | `#6B6B7B` | 보조 텍스트 |
| `line` | `#E8E8EE` | 경계선 |
| `primary` | `#5B3DF5` | 주요 버튼, 선택 상태, 전송 버튼 |
| `primary-soft` | `#EEEAFE` | 선택 배경, 칩 |
| `hero` | `#14141F` | 홈 히어로 카드, `초대` 버튼 |
| `danger` | `#E5484D` | 삭제, 공유 중지, 보낼 돈 |
| `positive` | `#16A34A` | 받을 돈 |
| 반경 | 카드 20px / 시트 24px / 칩·버튼 999px / 입력 14px | |
| 그림자 | `0 4px 20px rgba(20,20,31,.06)` | 카드 |

### 7-2. 카테고리 색 (배경 / 테두리 / 아이콘)

| 카테고리 | 배경 | 테두리 | 비고 |
|---|---|---|---|
| food 식사 | `#FDE8DF` | `#F2B79C` | 살구 |
| cafe 카페 | `#FBE3EE` | `#EBA6C6` | 분홍 |
| sightseeing 관광/산책 | `#DDF3E5` | `#8FD3A9` | 연두 |
| shopping 쇼핑 | `#DDEBFB` | `#9CC3EE` | 하늘 |
| activity 액티비티 | `#FFF1C9` | `#EFD173` | 노랑 |
| lodging 숙소 | `#E8E2FB` | `#B8A8EE` | 라벤더 |
| transport 이동 | `#ECECF1` | `#C9C9D6` | 회색 |
| other 기타 | `#ECECF1` | `#C9C9D6` | 회색 |

Day 색(지도 핀/경로): `#5B3DF5, #E5484D, #0E9AA7, #2563EB, #F59E0B, #16A34A, #DB2777` 순환.
차트(카테고리): 교통 `#4F7BE8`, 숙박 `#3BB58A`, 식비 `#E0604F`, 쇼핑 `#F2A93B`, 입장료 `#7C5CE0`, 기타 `#A0A0B0`.
발자취: 가봤어요 `#5B3DF5`(보라), 가보고 싶어요 `#F59E0B`(주황).

### 7-3. 타이포·컴포넌트·모션

- 폰트 Pretendard Variable(셀프 호스팅 또는 CDN), 본문 15px/22px, 숫자는 tabular-nums(금액 정렬).
- 아이콘 lucide-react. 토스트 sonner. 바텀시트는 vaul(Drawer), 데스크톱에서는 중앙 Dialog로 전환.
- 필수 공용 컴포넌트: `Card`, `Chip`(선택형), `Sheet/Drawer`, `Dialog`, `Tabs`(알약형), `Gauge`(SVG 원형 진행률), `AvatarStack`, `MoneyText`(통화 포맷), `EmptyState`, `Skeleton`, `ConfirmDialog`, `Toggle`.
- 터치 영역 최소 44px, 하단 고정 바는 `env(safe-area-inset-bottom)` 반영, iOS 입력 확대 방지(입력 폰트 16px).
- 모션은 150~200ms ease-out만. `prefers-reduced-motion` 존중.
- 금액 표기: 원화 `₩1,352,500`, 축약 `6.2만`, 외화는 통화 기호 `¥1,480`. 통화별 소수 자리는 `Intl.NumberFormat` 기준(JPY/KRW 0자리, USD/EUR 2자리).

---

## 8. 가정과 미정 사항

영상만으로 확정할 수 없었던 부분은 아래처럼 가정했다. 사용자가 바꾸라고 하면 바꾼다.

1. **예약·자료·아이디어**: 영상에 카드만 보임 → 4-9, 4-10, 4-8의 구조를 임의로 설계.
2. **이 지역 릴스**: 구현하지 않고 외부 검색 링크로 대체.
3. **실내 장소로 바꾸기**: 날씨 연동 없이 수동 토글 + AI 대안 제안으로 해석.
4. **발자취의 소유**: 여행 공유와 별개로 개인 데이터(익명 사용자 단위)로 설계. 기기 변경 시 JSON 내보내기/가져오기로 이전.
5. **이동 시간 정확도**: 한국 구간은 Google 제한으로 추정치가 많을 수 있음. 필요하면 카카오/네이버/T맵 어댑터를 추가.
6. **AI 모델**: 모델명은 구현 시점에 공식 문서로 확인. 영수증 인식은 이미지 입력을 지원하는 모델이 필요.
7. **인증 없음의 한계**: 초대 링크를 아는 사람은 누구나 입장 가능. 링크 유출 시 `공유 중지`/재발급으로 대응. 여권 사본 등 민감 파일 업로드 경고 문구 표시.
8. **"20가지 기능"**: 영상에서 구분되는 기능은 이 문서에 모두 반영. 나머지는 확인 불가.

---

## 부록 A. 작업 규칙 (CLAUDE.md에 그대로 넣을 것)

1. 이 문서(`docs/SPEC.md`)가 기준이다. 문서와 다르게 구현해야 하면 `docs/DECISIONS.md`에 이유를 한 줄 남긴다.
2. 6부 순서(M0→M12, 이어서 부록 F-6의 M13→M19)대로 진행하고, 단계마다 `pnpm typecheck && pnpm lint && pnpm test`를 통과시킨 뒤 커밋한다. 커밋 메시지는 `feat(M3): ...` 형식(영어).
3. TypeScript strict, `any` 금지(불가피하면 주석으로 이유). Supabase 타입은 `supabase gen types`로 생성한 것을 쓴다.
4. **비밀 키는 절대 클라이언트 번들, 커밋, 로그에 넣지 않는다.** 클라이언트 변수는 `VITE_` 접두사 공개 키(Supabase anon, 리퍼러 제한된 Maps 키)만. AI 키·Google 서버 키는 Edge Function 시크릿.
5. 외부 API 응답 형태를 기억에 의존해 추측하지 말고, 공식 문서를 확인하거나 실제 호출로 검증한다. 확인 못 하면 어댑터 뒤에 두고 TODO가 아니라 **오류 처리 + 폴백**을 구현한다.
6. 모든 서버 입력·AI 출력은 zod로 검증한다. AI 출력은 신뢰하지 않는다(좌표, 시간, 카테고리 enum 모두 검증/보정).
7. 낙관적 업데이트 + 실패 시 롤백 토스트. Realtime 이벤트로 TanStack Query 캐시를 갱신한다(전체 refetch 금지).
8. UI 문구는 한국어, 짧고 친근한 존댓말("~했어요"). 문구는 `src/copy.ts` 상수로 모은다.
9. 접근성: 아이콘 버튼에 `aria-label`, 모달 포커스 트랩, 색만으로 상태 구분 금지.
10. 순수 로직(`settlement`, `time`, `geo`, `money`, `csv`, 발자취 통계)은 반드시 vitest 테스트를 쓴다.
11. 돈이 드는 설정(Google Cloud 결제, 유료 AI), 계정/키 발급, 외부 서비스 가입이 필요한 지점에서는 멈추고 사용자에게 **무엇을 어떻게 해야 하는지** 안내한다.
12. 새 의존성을 추가할 때는 이유를 PR/커밋 본문에 쓴다. 번들 크기 큰 것(발자취 지도, 캘린더, 차트)은 라우트 단위 lazy 로드.

---

## 부록 B. 영상 기능 → 명세 매핑

| 영상에서 확인된 기능 | 명세 위치 |
|---|---|
| 채팅으로 도쿄 3박4일 일정 생성, 일차별 요약, 일정 보기 | 4-3, 5-2 |
| 추천 질문 칩(날씨·환율·일정) | 4-3, 5-2 |
| 일정 리스트, Day 접기/펼치기, 이동 시간·거리 칩, 장소 추가 | 4-4, 4-7 |
| 시간 변경 팝업(일차·시작·종료) | 4-4 |
| 실내 장소로 바꾸기 토글 | 4-4, 5-4 |
| 캘린더 시간표, 드래그로 시간·순서 변경, 툴팁 | 4-5 |
| 지도 번호 핀, 일자별 색 경로, 현위치·전체화면, Day 탭 | 4-6 |
| 자동 동선 | 4-6, 4-7 |
| 장소 탐색(도시 검색·카테고리·평점/리뷰·추가) | 4-8 |
| 이 지역 릴스 목록 | 4-8 (외부 링크로 대체) |
| 여행 홈(제목·날짜·장소 24곳·동행 초대) | 4-2 |
| 메뉴 카드 8종(아이디어·일정·예약·자료·비용·캘린더·체크리스트·동행) | 4-2, 4-8~4-13 |
| D-day, 준비율 게이지 | 4-2, 4-11 |
| 체크리스트(출발 전/준비물, 3/4, 5/7, 취소선) | 4-11 |
| 비용: 총지출·보낼 돈·받을 돈 | 4-12 |
| 비용: 카테고리 도넛, 사용자별 부담 도넛, 일자별 막대, 큰 지출 | 4-12 |
| 비용: 일자별 목록, 검색, 필터, CSV | 4-12 |
| 지출 추가(빠른 입력, 칩, 더보기: 금액·통화·Day·카테고리·결제수단·장소) | 4-12 |
| 영수증 사진 업로드 자동 입력 | 4-12, 5-3 |
| 정산(누가 누구에게, 정산 버튼, 잔액 +/-) | 4-12, 부록 C-2 |
| 초대 링크 시트(복사/닫기), 링크 복사하기/공유 중지, 공유 아이콘 | 4-13 |
| 발자취 세계 지도(보라/주황), 가봤어요/가보고 싶어요 팝업(시기·메모) | 4-14 |
| 한국 시·군 단위 지도 | 4-14 |
| 통계(나라·여행·장소·도시·일수·대륙·연 연속), 가보고 싶은 곳 탭 | 4-14 |
| 제주 등 국내 여행 경로 지도 | 4-6, 4-7 |

---

## 부록 C. 핵심 코드 스펙

> 이 부록의 C-1~C-4와 C-7의 `yearStreak`은 `starter/`에 **구현과 테스트가 완료**되어 있다(TypeScript strict 타입체크 통과, vitest 28개 통과). 문서와 코드가 다르면 `starter/` 코드를 기준으로 한다.

### C-1. 공용 타입·상수 (`src/types/domain.ts`)

```ts
export const PLACE_CATEGORIES = ['food','cafe','sightseeing','shopping','activity','lodging','transport','other'] as const;
export type PlaceCategory = typeof PLACE_CATEGORIES[number];

export const EXPENSE_CATEGORIES = ['transport','lodging','food','shopping','ticket','other'] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export type TravelMode = 'walk' | 'transit' | 'drive';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export const LABELS_KO = {
  food: '식사', cafe: '카페', sightseeing: '관광', shopping: '쇼핑', activity: '액티비티',
  lodging: '숙소', transport: '이동', other: '기타', ticket: '입장료',
} as const;
```

### C-2. 정산 (`src/lib/settlement.ts`) — 순수 함수, 서버/클라 공용

```ts
export type Id = string;
export interface ExpenseLite { id: Id; paidBy: Id; amountKrw: number }
export interface SplitLite { expenseId: Id; memberId: Id; shareKrw: number }
export interface SettlementLite { fromMember: Id; toMember: Id; amountKrw: number }
export interface Transfer { from: Id; to: Id; amountKrw: number }

/** +면 받을 돈, -면 줄 돈. 정산 완료분 반영. */
export function computeBalances(
  memberIds: Id[], expenses: ExpenseLite[], splits: SplitLite[], settlements: SettlementLite[],
): Record<Id, number> {
  const bal: Record<Id, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const add = (id: Id, v: number) => { bal[id] = (bal[id] ?? 0) + v; };
  for (const e of expenses) add(e.paidBy, e.amountKrw);
  for (const s of splits) add(s.memberId, -s.shareKrw);
  for (const t of settlements) { add(t.fromMember, t.amountKrw); add(t.toMember, -t.amountKrw); }
  return bal;
}

/** 탐욕적 최소 송금. 큰 채무자 ↔ 큰 채권자부터 매칭. */
export function minimizeTransfers(balances: Record<Id, number>): Transfer[] {
  const creditors: { id: Id; amt: number }[] = [];
  const debtors: { id: Id; amt: number }[] = [];
  for (const [id, v] of Object.entries(balances)) {
    if (v > 0) creditors.push({ id, amt: v });
    else if (v < 0) debtors.push({ id, amt: -v });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amountKrw: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

/** 균등 분담. 나머지 원 단위는 결제자(참여자일 때) 또는 첫 참여자에게. */
export function splitEqual(totalKrw: number, participantIds: Id[], payerId: Id): Record<Id, number> {
  const n = participantIds.length;
  if (n === 0) throw new Error('participants required');
  const base = Math.floor(totalKrw / n);
  const rem = totalKrw - base * n;
  const out: Record<Id, number> = Object.fromEntries(participantIds.map((id) => [id, base]));
  out[participantIds.includes(payerId) ? payerId : participantIds[0]] += rem;
  return out;
}
```

**필수 테스트 케이스**
1. A가 30,000원 결제, A·B·C 균등 → balances `A:+20000, B:-10000, C:-10000` → transfers `B→A 10000`, `C→A 10000`.
2. 10,000원을 3명 균등(결제자 A 포함) → `A:3334, B:3333, C:3333`, 합 10,000.
3. 정산 완료 반영: 위 1번에서 `B→A 10000` 정산 기록 추가 → B 잔액 0, 남은 transfer는 `C→A 10000`뿐.
4. 결제자가 분담자에 없는 경우(A가 결제, B·C만 부담) → `A:+total, B:-half, C:-half`.
5. 모든 잔액 합이 항상 0(정산 포함). 속성 기반 랜덤 테스트로 검증.
6. 영상 예시: 인서가 지우에게 ₩109,250 → transfers 1건, 금액 109250.

### C-3. 지리·시간 유틸

```ts
// src/lib/geo.ts
export interface LatLng { lat: number; lng: number }
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const SPEED_KMH = { walk: 4.5, transit: 20, drive: 30 } as const;
const EXTRA_MIN = { walk: 0, transit: 8, drive: 0 } as const;
/** 직선거리 ×1.3 보정한 추정치 */
export function estimateLeg(a: LatLng, b: LatLng, mode: 'walk' | 'transit' | 'drive') {
  const distanceM = Math.round(haversineM(a, b) * 1.3);
  const durationS = Math.round((distanceM / 1000 / SPEED_KMH[mode]) * 3600 + EXTRA_MIN[mode] * 60);
  return { distanceM, durationS, estimated: true as const };
}
```

```ts
// src/lib/time.ts
export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const toHHmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** 순서 변경 후 재배치. 소요시간 유지, 사이에 이동시간(없으면 15분) 삽입. */
export function reflow(
  items: { id: string; durationMin: number; legMinFromPrev?: number }[],
  firstStartMin: number,
): { id: string; startMin: number; endMin: number }[] {
  let cursor = firstStartMin;
  return items.map((it, idx) => {
    if (idx > 0) cursor += it.legMinFromPrev ?? 15;
    const start = cursor;
    const end = start + it.durationMin;
    cursor = end;
    return { id: it.id, startMin: start, endMin: end };
  });
}
```
- 자정을 넘기는 일정은 만들지 않는다. reflow 결과가 24:00을 넘으면 경고 토스트("하루를 넘겼어요")를 띄우고 23:59로 클램프.

### C-4. AI 스키마 (`src/schemas/ai.ts`, Edge Function과 공유)

```ts
import { z } from 'zod';
import { PLACE_CATEGORIES } from '../types/domain';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const AiItem = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(PLACE_CATEGORIES),
  startTime: hhmm,
  endTime: hhmm,
  isIndoor: z.boolean().nullable(),
  note: z.string().max(200).nullable(),
  searchQuery: z.string().min(1).max(120),   // Places 검색용 "상호명 + 지역"
});
export const AiDay = z.object({
  dayIndex: z.number().int().min(0),
  title: z.string().max(60),
  items: z.array(AiItem).min(1).max(10),
});
export const AiPlanResponse = z.object({
  reply: z.string(),                          // 채팅에 보여줄 한국어 답변
  intent: z.enum(['chat', 'itinerary']),
  itinerary: z.object({ days: z.array(AiDay).min(1) }).nullable(),
});
export type AiPlanResponse = z.infer<typeof AiPlanResponse>;

export const ReceiptResult = z.object({
  merchant: z.string().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  total: z.number().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  categoryGuess: z.enum(['transport','lodging','food','shopping','ticket','other']),
  items: z.array(z.object({ name: z.string(), amount: z.number() })).max(50),
  confidence: z.number().min(0).max(1),
});

export const IndoorAlternatives = z.object({
  alternatives: z.array(z.object({
    name: z.string(), category: z.enum(PLACE_CATEGORIES),
    searchQuery: z.string(), reason: z.string().max(80),
  })).min(1).max(3),
});
```

후처리 보정: 종료 ≤ 시작이면 시작+60분, 하루 장소가 10개 초과면 잘라냄, 카테고리 enum 외 값은 `other`, 같은 Day 안 시간 역전은 시작 시간 기준 정렬.

### C-5. 프롬프트 (`supabase/functions/_shared/prompts.ts`)

**ai-plan 시스템 프롬프트**
```
너는 개인 여행 플래너의 일정 설계 도우미다. 항상 한국어로 답한다.
출력은 지정된 JSON 스키마만 사용하고 JSON 밖에는 아무 글자도 쓰지 않는다.

[규칙]
- 사용자가 일정을 만들거나 고쳐 달라고 하면 intent="itinerary"와 itinerary를 채우고, 단순 질문이면 intent="chat", itinerary=null.
- 일정은 여행 일수와 같은 수의 day를 만들고 dayIndex는 0부터 시작한다.
- 하루 3~6개 장소, 시간은 24시간제 "HH:mm". 식사는 식사 시간대(아침 08~09, 점심 12~13, 저녁 18~19)에 둔다.
- 같은 날 장소는 지리적으로 가까운 순서로 묶고, 이동 시간을 고려해 사이에 여유를 둔다.
- 실제로 존재하는 유명하고 검증 가능한 장소만 쓴다. 불확실하면 쓰지 않는다.
- searchQuery는 "정확한 상호명 + 도시/동네" 형태로 쓴다.
- category는 food, cafe, sightseeing, shopping, activity, lodging, transport, other 중 하나.
- isIndoor는 확실하지 않으면 null.
- 이미 있는 일정(CONTEXT.currentItinerary)을 수정하라는 요청이면 수정이 반영된 "전체 일정"을 반환한다.
- 날씨·환율 정보는 CONTEXT에 주어진 값만 사용한다. 없으면 모른다고 말하고 추측하지 않는다.
- 비자·입국 규정은 변할 수 있으니 일반 안내 후 "공식 사이트에서 확인하세요"를 덧붙인다.
- reply는 3문장 이내로, 일정을 만들었다면 일차별 한 줄 요약을 포함한다.
```
**user 입력:** `CONTEXT: {json}\n\n요청: {message}` (CONTEXT = trip{title,startDate,endDate,dayCount,destinations,headcount,budget}, currentItinerary[], fx?, weather?)

**ai-receipt 프롬프트:** "이미지는 영수증이다. 상호명, 날짜(YYYY-MM-DD), 합계 금액(숫자만), 통화(ISO 4217 3글자), 분류 추정, 품목을 JSON 스키마대로 추출한다. 보이지 않는 값은 null. 금액에서 천 단위 구분 기호는 제거한다. 추정이 불확실하면 confidence를 낮춘다."

**ai-indoor-swap 프롬프트:** "다음 장소를 대체할 수 있는 같은 지역의 **실내** 장소 3곳을 제안한다. 같은 시간대에 방문 가능하고 이동이 짧은 곳을 우선한다. 비 오는 날 방문하기 좋은 이유를 reason에 한 줄로 쓴다."

### C-6. 환경 변수

`.env.example` (클라이언트, 공개 가능 값만)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_BROWSER_KEY=     # 리퍼러 제한 + Maps JS/Places만 허용
VITE_GOOGLE_MAP_ID=               # Cloud Console에서 만든 Map ID (AdvancedMarker 필수)
VITE_APP_BASE_URL=http://localhost:5173
```
Edge Function 시크릿 (`supabase secrets set ...`, 절대 커밋 금지)
```
GEMINI_API_KEY=
OPENROUTER_API_KEY=
GOOGLE_SERVER_KEY=                # Places API(New) + Routes API만 허용 (API 제한)
DEFAULT_GEMINI_MODEL=
DEFAULT_OPENROUTER_MODEL=
DAILY_LIMIT_AI=60
DAILY_LIMIT_ROUTES=400
DAILY_LIMIT_RECEIPT=30
APP_BASE_URL=                     # CORS 허용 출처
```

### C-7. 발자취 통계 함수 시그니처 (`src/features/footprints/stats.ts`)

```ts
export interface FootprintStats {
  countries: number; trips: number; places: number; cities: number;
  days: number; continents: number; yearStreak: number;
}
export function computeStats(input: {
  visitedCountryCodes: string[];
  pastTrips: { startDate: string; endDate: string; placeCount: number; cities: string[] }[];
  today: Date;
}): FootprintStats;
export function yearStreak(years: number[], thisYear: number): number;
// 현재 연 연속: thisYear 또는 thisYear-1에서 끝나는 연속 구간의 길이
```
테스트: `[2024,2025,2026]`, thisYear 2026 → 3 / `[2022,2024,2025]` → 2 / `[]` → 0 / `[2023]`, thisYear 2026 → 0.

---

## 부록 D. 사람이 직접 해야 하는 준비 (Claude Code가 해당 시점에 안내할 것)

> 상세 체크리스트는 `docs/SETUP_CHECKLIST.md`에 있다.

1. **Supabase 프로젝트 생성** → URL, anon key 확인 → Authentication에서 **Anonymous sign-ins 활성화** → 가능하면 Captcha 설정.
2. **Google Cloud 프로젝트** → 결제 계정 연결 → API 사용 설정: Maps JavaScript API, Places API (New), Routes API → **키 2개** 발급(브라우저용: 리퍼러 제한+API 제한 / 서버용: API 제한) → Map ID 생성 → **예산 알림 설정**.
3. **AI 키:** Gemini API 키(Google AI Studio), OpenRouter 키 (둘 다 넣으면 자동 전환 동작, 하나만 넣어도 동작).
4. **배포:** Vercel/Cloudflare Pages 프로젝트 연결, 환경변수 입력, 배포 도메인을 Google 키 리퍼러 제한과 Supabase `site_url`/CORS에 추가.
5. **지리 데이터:** 세계/한국 지도 파일 내려받기(라이선스 확인).
6. 로컬 개발: Docker + Supabase CLI 필요.

---

## 부록 E. Claude Code 첫 프롬프트

전달 패키지의 `PROMPT.md`를 그대로 사용한다(읽을 문서 순서, 시작 전 보고 형식, 단계별 보고·승인 규칙, 키 입력 안내 규칙 포함).

---

## 부록 F. 트리플(Triple) 벤치마크와 접목 기능

### F-0. 먼저 알아둘 점

- 트리플 정보는 **내 사전 지식 기준**이며 웹 조회로 확인하지 못했다. 앱은 계속 바뀌므로 아래 표의 확신도를 같이 본다. (`확실` = 오래 유지된 핵심 기능, `추정` = 있었던 것으로 기억하지만 현재 형태는 미확인)
- 정확한 복제가 목표가 아니다. 이 앱은 **개인+친구용 도구**이므로 트리플의 "콘텐츠·예약·커뮤니티 플랫폼" 부분은 가져오지 않고, "여행자가 실제로 쓰는 편의 기능"만 접목한다.
- 정확한 화면 구성이 필요하면 트리플 화면 녹화나 스크린샷을 받아 이 부록을 갱신한다.

### F-1. 트리플 기능 파악

| 영역 | 트리플 기능 | 확신도 |
|---|---|---|
| 일정 | 도시·날짜로 일정 만들기, 자동 추천 일정 | 확실 |
| 일정 | 장소 드래그 편집, 일정별 지도, 장소 간 이동 시간 | 확실 |
| 일정 | 일정 공유, 동행과 함께 편집 | 추정 |
| 도시 정보 | 도시 홈: 인기 관광지·맛집, 환율·날씨·시차·전압·비자 같은 현지 정보 | 확실(항목 구성은 추정) |
| 장소 | 장소 상세(사진, 리뷰, 영업시간, 현지어 주소, 길찾기), 저장(찜) | 확실 |
| 후기 | 장소 리뷰, 여행 후기/여행기 작성 | 확실 |
| 예약 | 항공·숙소·투어/티켓·렌터카·유심 예약과 내 예약 내역 모아보기 | 확실 |
| 예약 | 예약 내역 자동 불러오기 | 추정 |
| 오프라인 | 오프라인에서 일정·지도 보기 | 추정 |
| 준비 | 환율 계산기, 여행 준비 체크리스트 | 추정 |
| 가계부 | 여행 가계부 | 추정 |
| 커뮤니티 | 여행 Q&A, 후기 피드, 리워드/포인트 | 확실 |

### F-2. 접목 결정

| 트리플 기능 | 결정 | 이 앱에서의 형태 | 절 |
|---|---|---|---|
| 일정 만들기 시 취향 선택(동행·속도·테마) | **채택** | AI 일정 마법사 | F-3-1 |
| 예약 내역 자동 불러오기 | **변형** | 확인 메일/문자 붙여넣기·캡처 → AI 파싱 | F-3-2 |
| 도시 정보(환율·날씨·시차·전압·긴급번호) | **채택** | 여행 정보 화면 + 환율 계산기 | F-3-3 |
| 오프라인 사용 | **변형** | 읽기 캐시 + 일부 쓰기 큐 + 현지어 오프라인 카드 | F-3-4 |
| 장소 저장(찜) | **채택** | 개인 "내 저장" + 아이디어 보관함 연동 | F-3-5 |
| 장소 리뷰/후기 | **변형** | 우리끼리 별점·한줄평·사진 + AI 회고 | F-3-6 |
| 일정 공유 | **채택** | 읽기 전용 공유 링크 | F-3-7 |
| 남의 일정 가져오기/복제 | **채택** | 여행 복제, 공유 링크에서 가져오기 | F-3-8 |
| 여행 중 화면 | **채택** | 여행 전/중/후 상태별 홈 | F-3-9 |
| 주변 장소 찾기 | **채택** | 지도 "근처 보기" | F-3-10 |
| 항공·숙소·투어 예약/가격 비교 | 제외 | 비목표 유지 | — |
| 커뮤니티 Q&A, 후기 피드, 포인트 | 제외 | 소규모 개인용이라 불필요 | — |
| 공개 인기 일정 추천 피드 | 제외 | 데이터 소스 없음. AI 일정이 대체 | — |

### F-3. 접목 기능 상세

#### F-3-1. AI 일정 마법사 (4-3 채팅 확장)

- 채팅 화면의 "도쿄 3박4일 맛집투어 짜줘" 칩 옆에 `일정 만들기` 버튼. 탭하면 한 화면에 한 질문씩 **칩 선택 마법사**(건너뛰기 가능, 총 6단계 이내):
  1. 누구와: 혼자 / 연인 / 친구 / 가족 / 아이 동반 / 부모님
  2. 속도: 느긋(하루 3곳 안팎) / 보통(4~5곳) / 빡빡(6곳 이상)
  3. 테마(복수): 맛집, 카페, 관광·역사, 자연·산책, 쇼핑, 사진, 체험, 야경
  4. 이동: 도보·대중교통 / 택시·렌터카 포함
  5. 꼭 가고 싶은 곳: 아이디어 보관함·내 저장에서 체크(복수), 직접 입력
  6. 피하고 싶은 것: 긴 웨이팅, 많이 걷기, 야외 위주, 이른 아침
- 결과는 `trips.planning_prefs`(jsonb)에 저장하고 이후 모든 AI 호출 컨텍스트에 포함. 채팅에서 "더 느긋하게"처럼 말하면 prefs도 같이 갱신하도록 AI 응답 스키마에 `prefsPatch`(선택)를 추가한다.
- `ai-plan` 프롬프트 추가 규칙:
  ```
  - CONTEXT.planningPrefs를 반영한다. pace가 relaxed면 하루 3곳 이내, busy면 6곳 이상.
  - CONTEXT.mustInclude(아이디어 보관함·사용자 지정 장소)는 반드시 일정에 포함하고, 불가하면 reply에 이유를 쓴다.
  - avoid 항목에 해당하는 장소는 넣지 않는다.
  ```
- 타입: `PlanningPrefs = { companions?: string; pace?: 'relaxed'|'normal'|'busy'; themes?: string[]; transport?: 'public'|'car'; avoid?: string[]; mustInclude?: string[] }`

#### F-3-2. 예약 자동 입력 (4-9 확장)

- 예약 추가 시트에 3가지 방법: `직접 입력` / `확인 메일·문자 붙여넣기` / `캡처 업로드`.
- Edge Function `ai-reservation`: 입력 `{ tripId, text? , imagePath? }` → zod `ReservationParse`로 검증 → 폼에 **미리 채우기만**(저장은 사용자 확인 후).
  ```ts
  export const ReservationParse = z.object({
    type: z.enum(['flight','lodging','transport','restaurant','ticket','other']),
    title: z.string().max(100),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(), // 현지 벽시계, tz 없음
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    confirmationNo: z.string().nullable(),
    locationName: z.string().nullable(),     // 숙소명/공항/식당
    amount: z.number().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    note: z.string().max(300).nullable(),
    confidence: z.number().min(0).max(1),
  });
  ```
- 프롬프트: "예약 확인서에서 값을 추출한다. 시간은 문서에 적힌 현지 시각 그대로 `YYYY-MM-DDTHH:mm`로 쓴다. 없는 값은 null. 추측하지 않는다."
- 저장 후 후속 제안(토스트 버튼): 숙소 → "체크인/체크아웃을 일정에 추가"(lodging 장소 생성+지도 핀), 항공 → 첫날/마지막날에 이동 항목 추가, 금액이 있으면 → "비용으로 추가".
- **개인정보:** 붙여넣은 원문은 서버에 저장·로그하지 않는다. 캡처 이미지는 처리 후 삭제(자료로 보관을 선택한 경우만 trip-files에 저장). 확인번호는 예약 행에만 저장한다.
- 한도: `DAILY_LIMIT_RESERVATION=30`.

#### F-3-3. 여행 정보 화면 `/t/:tripId/info` (여행 홈 카드 `정보` 추가)

섹션(목적지가 여러 곳이면 상단에서 나라/도시 전환):
1. **현지 시각·시차:** `Intl.DateTimeFormat`에 IANA 시간대(`src/data/country-info.ts`의 `timezones`)로 계산. "도쿄 14:20 · 한국과 시차 없음".
2. **날씨:** Open-Meteo 예보 `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16` (키 불필요, 브라우저 직접 호출). 여행일이 예보 범위 밖이면 "작년 같은 기간 실제 날씨"를 `https://archive-api.open-meteo.com/v1/archive`로 보여주고 "예보 아님"을 명시. 여행 Day 헤더에 날씨 아이콘+최고/최저 기온 배지(선택).
3. **환율 계산기:** 현지통화↔원화 양방향 숫자 키패드, 최근 환율 날짜 표시. `fx-rate` 결과를 IndexedDB에 저장해 오프라인에서는 마지막 값 사용("N일 전 환율"). 지출 폼의 환율도 같은 소스.
4. **기본 정보:** 통화, 전압·주파수·플러그 형태, 긴급 전화번호(경찰/구급), 공용어. 데이터는 `src/data/country-info.ts`에 정적으로 두되 **공식 출처로 확인해서 작성**하고 확신 없는 필드는 비워 둔다(빈 필드는 화면에서 숨김). 각 나라에 `verifiedAt` 날짜를 기록하고 화면에 "정보는 변동될 수 있어요" 문구를 표시한다.
5. **공식 링크 모음:** 외교부 해외안전여행(`https://www.0404.go.kr`), 해당국 대사관 정보 링크, 비자·입국 규정은 **직접 서술하지 않고 링크로만** 안내(틀리면 입국 문제로 이어지므로).
6. AI 채팅의 날씨·환율 칩은 이 화면의 데이터를 컨텍스트로 재사용(5-2의 보강 로직과 동일 소스).

#### F-3-4. 오프라인 (PWA 확장, M17)

- **읽기 캐시:** TanStack Query `PersistQueryClientProvider` + IndexedDB(`idb-keyval`) 퍼시스터, `maxAge` 7일, 여행 관련 쿼리만 영속화(AI/Places/검색 제외). `vite-plugin-pwa`로 앱 셸 프리캐시.
- **오프라인 배너:** `navigator.onLine`/`onlineManager`로 감지 → 상단에 "오프라인이에요 · 연결되면 동기화돼요".
- **쓰기 큐(제한 범위):** 체크리스트 토글, 지출 추가(영수증 첨부 제외), 장소 메모. 클라이언트에서 UUID를 미리 만들어 재시도 시 중복 방지(upsert). 큐 대기 개수를 배너에 표시. 충돌은 마지막 쓰기 우선. 그 외 기능(AI, 장소 검색, 파일 업로드)은 오프라인에서 비활성+안내.
- **오프라인 카드 준비:** 일정 화면 메뉴 `오프라인용으로 저장`. 일정의 각 장소에 대해 현지어 이름·주소를 가져와 **기기(IndexedDB)에만** 저장한다 (`GET https://places.googleapis.com/v1/places/{id}?languageCode={현지어}` + `X-Goog-FieldMask: displayName,formattedAddress`, 브라우저 키 사용). 서버 DB에는 저장하지 않는다(약관·최신성).
- **현지어 주소 카드:** 장소 상세에서 `기사님께 보여주기` → 현지어 이름·주소를 큰 글씨 전체 화면으로 표시(택시용). 오프라인이면 저장된 값 사용, 없으면 장소명만.
- **길찾기 딥링크:** `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&destination_place_id={id}&travelmode={walking|transit|driving}`로 지도 앱 열기(앱 쪽 오프라인 지도는 사용자가 따로 받아둘 수 있다고 안내).
- 구글 지도 타일 자체의 오프라인 캐시는 **하지 않는다**(약관). 오프라인 지도 화면은 "좌표 기반 간이 목록 + 길찾기 버튼"으로 대체한다.

#### F-3-5. 내 저장 (개인 위시리스트)

- 장소 카드·상세·지도 인포카드에 `♡ 저장` 버튼. 저장은 **여행과 무관한 개인 데이터**(`saved_places`).
- `/saved` 화면: 나라/도시별 그룹, 카테고리 필터, 지도 보기, 메모 편집, 삭제.
- 연결: ① 새 여행 생성 시 목적지 도시와 일치하는 저장 장소를 "아이디어로 가져올까요?" 제안, ② 아이디어 보관함 `내 저장에서 가져오기`, ③ 마법사의 "꼭 가고 싶은 곳" 후보, ④ 탐색 결과에서 이미 저장한 곳은 하트 채움 표시.
- 아이디어 보관함(여행 단위, 공유)과의 차이를 UI 문구로 구분한다: 보관함 = "이 여행에서 같이 고르는 후보", 내 저장 = "나만의 가고 싶은 곳".

#### F-3-6. 장소 후기와 AI 회고

- 여행 중/후에 일정 장소마다 `후기 쓰기`: 별점(1~5), 한줄평, 사진(최대 5장, 리사이즈 1600px). 멤버별로 1개(수정 가능). 장소 카드에 평균 별점과 작성자 아바타 표시.
- 여행 종료 후 홈에 `회고 만들기` 카드 → `ai-recap` Edge Function: 서버가 장소(이름·후기·평점)·Day 구조·통계(장소 수, 일수)를 모아 AI에 전달 → 결과를 `trips.recap`(jsonb)에 저장.
  ```ts
  export const RecapResult = z.object({
    title: z.string().max(60),
    summary: z.string().max(500),
    highlights: z.array(z.string().max(80)).min(3).max(5),
    dayNotes: z.array(z.object({ dayIndex: z.number().int().min(0), line: z.string().max(120) })),
  });
  ```
  프롬프트 규칙: 금액·확인번호·개인정보 언급 금지(공유 링크에 노출될 수 있음), 후기에 없는 사실을 만들지 않음, 따뜻하고 짧은 문체.
- 회고 화면 `/t/:id/recap`: 제목, 요약, 하이라이트, Day별 한 줄, 별점 높은 곳 TOP 3(사진 포함), 지도(경로). `다시 만들기`, `직접 수정` 가능.
- 발자취(4-14)에 여행 연결: 회고 대표 사진/제목을 가봤어요 나라 시트에 표시.

#### F-3-7. 읽기 전용 공유 링크

- 기존 초대 링크(편집 참여)와 **별개**로 `view_token`을 둔다. `/v/:viewToken`은 로그인·닉네임 없이 열리는 읽기 전용 페이지.
- 노출 범위: 제목, 날짜, 목적지, 일정(Day·시간·장소명·카테고리·주소·메모), 지도, 회고. **비용, 예약(확인번호), 자료, 체크리스트, 채팅, 멤버 목록은 노출하지 않는다.**
- 구현: RPC `get_shared_trip(token)`(security definer, anon 실행 허용)이 위 범위만 jsonb로 반환. 페이지는 일정 리스트 + 지도 + 회고를 표시하고 `이 일정 내 여행으로 가져오기`(F-3-8) 버튼 제공.
- 동행 화면에 `보기 링크` 섹션: 켜기/끄기(끄면 토큰 null), 링크 복사, 재발급. 소유자만 조작.
- `<meta name="robots" content="noindex">`를 넣고 OG 태그로 제목·날짜 미리보기를 제공한다.

#### F-3-8. 여행 복제·가져오기

- 여행 홈 `⋮` → `이 여행 복제`: 제목, 시작일, 내 닉네임 입력 → 일정·목적지·(선택)체크리스트를 새 여행으로 복사. 시간은 유지, 날짜만 새 시작일 기준. 이동 정보 캐시는 비우고 재계산. 비용·예약·자료·후기는 복사하지 않는다.
- 읽기 전용 링크 페이지의 `가져오기`: 로그인 불필요(익명 세션 자동 생성) → 같은 입력 → 새 여행 생성.
- 용도: 가족 여행 재사용, 친구가 짠 일정 기반으로 내 여행 시작.

#### F-3-9. 상태별 여행 홈 (4-2 확장)

여행 홈이 날짜에 따라 **전/중/후** 레이아웃으로 바뀐다 (4-2의 기본 카드 구성은 유지하고 상단 블록만 교체).

| 상태 | 상단 블록 |
|---|---|
| 출발 전 | D-day, 준비율 게이지 2개, 미완료 체크리스트 3개, 예약 임박 항목 |
| 여행 중 | `오늘 Day k` 타임라인, **다음 장소 카드**(남은 시간, 이동 칩, `길찾기`·`기사님께 보여주기` 버튼), 오늘 날씨 배지, 빠른 `+ 지출`(FAB), 환율 계산기 바로가기 |
| 여행 후 | `회고 만들기`/회고 카드, 후기 미작성 장소 수, 정산 미완료 시 정산 배너, 발자취 등록 제안 |

- 여행 중 판정: 현지 날짜가 start~end 안. 현지 날짜는 목적지 시간대 기준(`country-info`의 timezone).
- 다음 장소: 현재 현지 시각 이후 가장 가까운 시작 시간의 장소. 모두 지났으면 "오늘 일정이 끝났어요"와 내일 첫 일정.
- 여행 중 빠른 지출: 금액 숫자 키패드 → 통화는 목적지 통화 기본, 카테고리 칩 한 번 → 저장(분담은 전원 균등 기본). 3탭 안에 끝나야 한다.

#### F-3-10. 지도 근처 보기 (4-6 확장)

- 지도 우측 컨트롤에 `근처 보기`: 현재 지도 중심(또는 내 위치) 반경 1km에서 카테고리 칩(맛집·카페·관광·편의점/ATM·화장실) 선택 → Places Nearby Search(New)로 핀 표시 → 핀 탭 시 `+ 일정`/`♡ 저장`/`아이디어로`.
- 클라이언트 라이브러리(`Place.searchNearby`, `includedPrimaryTypes`, `maxResultCount`≤20)를 쓰고, 결과는 저장하지 않고 화면에만 표시한다.
- 일정 중 "다음 장소 주변 맛집" 단축 버튼: 일정 카드 `⋮` → `주변 맛집 찾기`.

### F-4. 데이터 모델 변경 — `supabase/migrations/0002_triple_features.sql` (이미 작성·검증됨)

- `trips`에 `planning_prefs`, `view_token`, `recap` 컬럼 추가 (`planning_prefs`, `recap`은 멤버가 update 가능, `view_token`은 RPC로만 변경).
- 새 테이블: `place_reviews`(본인 멤버 id로만 작성/수정), `place_photos`, `saved_places`(개인 소유). RLS와 Realtime 포함.
- 새 RPC: `set_view_link`, `get_shared_trip`(anon 실행 허용, 비용·예약·자료·채팅·멤버 제외), `duplicate_trip`, `import_shared_trip`, 내부 함수 `_copy_trip`(직접 호출 불가).
- 검증 항목(M18에서 재확인): view_token 보유자가 `get_shared_trip` 외 모든 테이블에서 0행, 멤버가 아닌 사용자의 `duplicate_trip` 거부, `_copy_trip` 직접 호출 거부.

### F-5. 추가·변경되는 라우트, 메뉴, 서버 함수

- 라우트: `/v/:viewToken`(읽기 전용), `/t/:tripId/info`, `/t/:tripId/recap`, `/saved`.
- 여행 홈 메뉴 카드에 `정보`, `회고`(여행 후), 내 저장은 더보기/사이드바에 추가.
- Edge Functions 추가: `ai-reservation`(F-3-2), `ai-recap`(F-3-6). 둘 다 5-0의 공통 규칙·`api_usage` 한도·`runAi` 어댑터(폴백 포함)를 그대로 사용한다. `DAILY_LIMIT_RESERVATION=30`, `DAILY_LIMIT_RECAP=10`.
- `ai-plan`: 컨텍스트에 `planningPrefs`, `mustInclude` 추가, 응답 스키마에 선택 필드 `prefsPatch` 추가.
- 클라이언트 직접 호출 외부 API 추가: Open-Meteo(예보·과거 날씨, 키 없음), Places REST 현지어 조회(브라우저 키).
- 시크릿 추가 없음(기존 키 재사용).

### F-6. 구현 단계 추가 (M13 이전에 끼워 넣기)

기존 M12(발자취)까지 끝낸 뒤 M13(마감) 전에 아래를 진행하고, 마감은 M19로 옮긴다.

| 단계 | 내용 | 완료 조건 |
|---|---|---|
| M13. 마법사·저장 | AI 일정 마법사(`planning_prefs`, `mustInclude`), 내 저장(`/saved`)과 아이디어 연동 | 마법사 답변이 생성 일정에 반영, 저장 장소가 마법사 후보에 표시 |
| M14. 정보·환율 | `country-info` 데이터, `/info` 화면(시차·날씨·환율 계산기·기본 정보·공식 링크), Day 헤더 날씨 배지 | 여행일이 16일 이내/밖 모두 날씨 표시 규칙대로 동작, 오프라인에서 환율 마지막 값 사용 |
| M15. 여행 중 모드 | 전/중/후 홈, 다음 장소 카드, 빠른 지출, 길찾기 딥링크, 주변 장소 찾기 | 현지 날짜 기준 상태 전환, 3탭 이내 지출 저장 |
| M16. 예약 자동 입력 | `ai-reservation`, 붙여넣기·캡처 입력, 후속 제안 | 샘플 확인 메일 3종(항공/숙소/식당)이 폼에 채워짐, 원문 미저장 |
| M17. 오프라인 | 쿼리 영속화, 배너, 쓰기 큐(체크리스트·지출·메모), 현지어 오프라인 카드, 기사님께 보여주기 | 비행기 모드에서 일정·체크리스트·지출 조회/추가 가능, 복구 시 동기화 |
| M18. 후기·회고·공유 | 후기(별점·한줄평·사진), `ai-recap`, `/recap`, 읽기 전용 링크, 여행 복제·가져오기 | 시크릿 창에서 `/v/:token` 열람 가능, 비용·예약 번호 비노출 확인 |
| M19. 마감 | 기존 M13 내용(접근성, PWA 설치, 성능, README, 스모크 테스트, 배포) + 신규 화면 포함 | 모바일/데스크톱 점검 통과 |

### F-7. 추가 테스트 항목

- `reflow`·`splitEqual` 기존 테스트 유지.
- `nextPlace(places, nowLocal)`: 현재 시각 이후 가장 가까운 장소 선택, 모두 지난 경우 처리.
- `tripPhase(trip, nowInTz)`: 전/중/후 판정(경계일 포함, 시간대 차이로 하루 어긋나는 경우).
- `fx offline fallback`: 네트워크 실패 시 저장된 환율과 날짜 반환.
- RLS: view_token 보유자(anon)가 `get_shared_trip` 외 모든 테이블에서 0행, 멤버가 아닌 사용자가 `duplicate_trip` 호출 시 거부.
- `ReservationParse`, `RecapResult` zod 검증 단위 테스트(경계값, null 필드).
