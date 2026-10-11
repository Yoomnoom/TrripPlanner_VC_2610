# HUMAN_TODO — 이 순서대로만 하면 되는 최종 체크리스트

## 내가 가장 먼저 할 일 5가지
1. **Google Cloud 결제 연결 + 월 예산 알림($10/$30) 먼저 설정**, 그다음 API 3개 활성화 (1-1)
2. **Google 키 2개(브라우저 키는 리퍼러 제한, 서버 키는 API 제한) + Map ID 발급** → `.env.local`, `supabase/functions/.env`에 입력 (1-2)
3. **`supabase/functions/.env`에 `DAILY_LIMIT_AI=30` 추가**, OpenRouter 크레딧 충전(현재 402) 또는 그 제공자는 쓰지 않기 (1-3)
4. **Supabase 프로젝트 생성 → 익명 로그인 켜기 → `db push` · `functions deploy` · `secrets set`** (2-1, 2-2)
5. **Vercel 배포 후 배포 도메인을 Google 키 리퍼러·Supabase `site_url`·`APP_BASE_URL`에 추가**하고 `docs/QA_CHECKLIST.md` 플로우 1·2 확인 (2-3)

## 키 입력 후 필요한 개발 작업 (아직 구현되지 않음)
- **PlacesProvider의 Google 구현체가 없어요.** 지금 장소 검색·탐색은 직접 입력만 되고(`src/providers/places.ts`는 인터페이스+직접 입력 구현만 있음), 키를 넣어도 자동완성·상세·사진·좌표 조회는 켜지지 않아요. 키 입력 후 Google 구현체(검색/상세/좌표, Places API New)를 추가하고 `getPlacesProvider()`가 `googleEnabled`일 때 반환하도록 연결해야 해요. 장소 좌표가 생기면 이동 칩·지도 핀·오프라인 현지어 카드도 함께 완전히 동작해요.
- 같은 이유로 새 여행의 도시 자동완성(현재는 나라 선택 + 도시 직접 입력)도 이때 교체해요.

---

순서는 **① 키 입력 → ② 마이그레이션·함수 배포 → ③ UNVERIFIED 항목 검증**입니다. 각 항목에 단계 / 예상 소요 / 확인 방법 / 실패 시 증상을 적었습니다.
키는 **대화에 붙여넣지 말고** 표시된 위치에만 넣으세요. 비용이 드는 설정(결제, 유료 AI)은 직접 판단하세요.

---

## ① 키 입력 (약 1시간)

### 1-1. Google Cloud 프로젝트 · 결제 · 예산 알림 (필요 단계: M4, M10, M17)
- 소요: 약 30분 (결제 카드 등록 포함, 비용이 발생할 수 있어요)
- 단계: Cloud Console에서 프로젝트 생성 → 결제 계정 연결 → **결제 > 예산 및 알림에서 월 예산 알림($10, $30) 먼저 설정** → API 사용 설정: Maps JavaScript API, Places API (New), Routes API
- 확인: 대시보드 > API 및 서비스에 3개가 "사용 설정됨"
- 실패 시: 지도가 회색이거나 `This page can't load Google Maps correctly` = 결제 미등록·API 미활성화

### 1-2. Google 키 2개 + Map ID 발급 (필요 단계: M4, M10, M17)
- 소요: 약 15분
- 브라우저 키: **HTTP 리퍼러 제한**(`http://localhost:5173/*`, 배포 후 도메인 추가) + Maps JavaScript / Places API (New)만 허용 → `.env.local`의 `VITE_GOOGLE_MAPS_BROWSER_KEY`
- Map ID: 지도 관리에서 JavaScript용 Map ID 생성 → `.env.local`의 `VITE_GOOGLE_MAP_ID`
- 서버 키: **API 제한**(Places API (New) + Routes API만) → `supabase/functions/.env`의 `GOOGLE_SERVER_KEY` (배포 시 `supabase secrets set`)
- 확인: 일정 → `지도` 탭에 번호 핀·Day 색·Day 필터, 이동 칩의 `~`가 한국 밖 구간에서 사라짐(한국 구간은 `~` 유지가 정상)
- 실패 시: 핀 안 보임 = Map ID 누락, 칩이 계속 `~` = `routes-leg` NO_KEY/UPSTREAM 오류(함수 로그)

### 1-3. AI 키 점검 · 모델 · 한도 (필요 단계: M9, M11, M16, M18)
- 소요: 약 10분
- Gemini: 키는 이미 동작 확인됨(모델은 ListModels로 자동 선택). 고정하려면 `supabase/functions/.env`에 `DEFAULT_GEMINI_MODEL=` 추가
- OpenRouter: 테스트 결과 **HTTP 402(크레딧 부족)** → openrouter.ai에서 충전하거나 무료 모델을 `DEFAULT_OPENROUTER_MODEL`로 지정
- 비용 보호: `supabase/functions/.env`에 `DAILY_LIMIT_AI=30` 추가(무인 모드에서는 이 파일을 건드리지 않았어요, 기본값 60)
- 확인: 채팅 → AI 설정 → 각 제공자 `연결 테스트`가 `연결됐어요`
- 실패 시: `AI 응답을 받지 못했어요` = 두 제공자 실패. 로그의 `ai-plan AI_FAILED: gemini: … | openrouter: …`에 제공자별 원인(예: HTTP 429 = 요청 한도)이 남아요

---

## ② 마이그레이션 · 함수 · 배포 (약 1~2시간, 필요 단계: 전체)

### 2-1. Supabase 프로젝트 생성과 연결
- 소요: 약 20분
- 단계: Supabase에서 프로젝트 생성 → Authentication에서 **Anonymous sign-ins 활성화**(가능하면 Captcha) → `pnpm exec supabase link --project-ref <ref>`
- 확인: Authentication 설정에서 Anonymous 켜짐

### 2-2. DB와 함수 배포
- 소요: 약 20분
- 단계: `pnpm exec supabase db push`(마이그레이션 0001~0003) → `pnpm exec supabase functions deploy` → `pnpm exec supabase secrets set GEMINI_API_KEY=… OPENROUTER_API_KEY=… GOOGLE_SERVER_KEY=… APP_BASE_URL=https://<배포 도메인>`
- 확인: 대시보드 Edge Functions 8개(ai-plan ai-status ai-indoor-swap ai-receipt ai-reservation ai-recap routes-leg fx-rate), `supabase/tests/rls_smoke.sql`을 원격이 아닌 **로컬**에서 다시 실행해 README 기대 결과와 일치
- 실패 시: 함수 호출이 CORS 오류 = `APP_BASE_URL`에 배포 도메인 누락, `functions/_shared` import 오류 = 함수 배포 번들러 문제(UNVERIFIED: `functions deploy`가 `src/lib`가 아닌 `_shared`만 참조하도록 설계됨)

### 2-3. 프런트 배포
- 소요: 약 20분
- 단계: Vercel(또는 Cloudflare Pages) 연결 → 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_GOOGLE_MAP_ID` 입력 → 배포(`vercel.json` 포함)
- 이후: 배포 도메인을 Google 브라우저 키 리퍼러 제한, Supabase `site_url`/추가 리다이렉트에 추가
- 확인: 배포 주소에서 `docs/QA_CHECKLIST.md`의 핵심 플로우 1·2 통과
- 실패 시: 새로고침하면 404 = SPA 리라이트 미적용, 업데이트 후 옛 화면 = 서비스 워커 갱신(앱 완전 종료 후 재실행)

---

## ③ UNVERIFIED 항목 검증 (약 2시간, 키·배포 후)

| 단계 | 무엇을 | 방법 | 실패 시 증상 |
|---|---|---|---|
| M3·M5 | 드래그 정렬·캘린더 이동/리사이즈 | 리스트 손잡이로 순서 변경→시간 재배치+되돌리기, 캘린더 블록 이동·리사이즈·빈 칸 선택 추가 | 원위치로 튐(저장 실패 토스트) |
| M4 | 지도·Routes 실응답 | 1-2 확인 | 회색 지도 / `~`만 표시 |
| M6~M8 | 체크리스트·비용·정산 화면 | 두 창으로 체크/지출/정산 동기화 | 저장 실패 토스트(콘솔 확인) |
| M9 | OpenRouter 연결 | 1-3 확인 | HTTP 402 |
| M10 | 탐색 검색·실내 대안 | Google 키 후 PlacesProvider 구현 연결(BACKLOG) / Day 헤더 `실내로` 스위치 | 후보에 `위치 미확인` = 서버 키 없음 |
| M11 | 실제 영수증 | 지출 추가 → 영수증 사진 자동 입력 | `영수증을 읽지 못했어요` = 이미지 미지원 모델 |
| M12 | 지도 터치·검색 이동 | 스마트폰에서 핀치 줌, `일본` 검색, 설정 내보내기→가져오기 | 지도 흰 화면 = 개발 서버면 `vite --force` |
| M14 | 국가 기본 정보 | `src/data/country-info.ts`를 외교부 해외안전여행과 대조 후 `verifiedAt` 기입 | 틀린 값 |
| M15 | 여행 중 모드 | 오늘이 포함된 여행에서 `다음 장소`·길찾기·기사님께 보여주기·빠른 지출 | `다음 장소` 안 보임 = 오늘 Day에 시간 있는 장소 없음 |
| M16 | 실제 예약 메일·캡처 | 예약 → 메일·문자 붙여넣기 / 캡처 업로드 | 날짜 어긋남(폼에서 수정) |
| M17 | 비행기 모드 | 온라인에서 연 뒤 `오프라인용으로 저장` → 비행기 모드: 조회, 체크·지출·메모 대기 후 `동기화했어요` | 오프라인 새로고침이 `접속하지 못했어요`(온라인에서 한 번 더 열기) |
| M17 | 현지어 이름·주소 | Google 키 후 `오프라인용으로 저장` | 현지어가 비어 있음 = 키/언어 매핑 |
| M18 | AI 회고 실호출 | 여행 후 상태에서 `회고 만들기`(Gemini 429로 이번엔 미확인) | 회고 실패 = 한도/키 |
| M18 | 읽기 전용 링크 | 동행 화면 `보기 링크 만들기` → 시크릿 창에서 열기·가져오기·중지 | 링크가 열리지 않음 |
| M19 | PWA 설치·접근성 | `docs/QA_CHECKLIST.md`의 ☐ 항목 | 아이콘 이상 / 포커스 안 보임 |

---

## 참고: BACKLOG (구현하지 않은 아이디어)
`docs/BACKLOG.md` 참고 — Google PlacesProvider 구현체, 고정 일정 배너, 새 여행 시 내 저장 제안, 오프라인 일정 구조 변경 큐잉, 공유 링크 OG 메타(엣지/프리렌더 필요), 회고 지도 등.
