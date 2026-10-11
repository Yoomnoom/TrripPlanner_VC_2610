# HUMAN_TODO (사용자가 직접 해야 할 일 — 무인 모드 중 누적)

각 항목: 단계 / 예상 소요 / 필요한 단계 번호 / 확인 방법 / 실패 시 증상. 마지막에 최종 체크리스트로 정리한다.

## 누적 목록

### [M4] Google 키 입력 후 지도·경로 확인 (UNVERIFIED)
- 필요 단계: M4 (이후 M3 Places 검색 교체, M10, M13 공통)
- 할 일(약 40분, 결제 등록 포함): Google Cloud 프로젝트 → 결제 계정 → Maps JavaScript / Places API (New) / Routes API 활성화 → 브라우저 키(리퍼러 `http://localhost:5173/*`, 위 두 API만)와 서버 키(Places·Routes만) 발급 → Map ID 생성 → 예산 알림 설정.
- 키 입력: 브라우저 키·Map ID는 `.env.local`의 `VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_GOOGLE_MAP_ID`. 서버 키는 `supabase/functions/.env`의 `GOOGLE_SERVER_KEY` (대화에 붙여넣지 않기).
- 확인 방법: 일정 화면 `지도` 탭에 번호 핀·Day 색·Day 필터가 보임. 좌표 있는 장소 2개 사이 이동 칩에서 `~`가 사라지면 Routes 응답 성공(한국 구간은 `~` 유지가 정상).
- 실패 시 증상: 지도가 회색/`This page can't load Google Maps correctly` = 키 제한·결제 미등록. 칩이 계속 `~` = `routes-leg`가 NO_KEY/UPSTREAM 오류(함수 로그 확인). 핀이 안 보임 = Map ID 누락.

### [M5] 캘린더 드래그·리사이즈 눈 확인 (UNVERIFIED)
- 필요 단계: M3 드래그 정렬, M5 (약 5분)
- 방법: 일정 → 캘린더 탭에서 블록을 다른 Day 열로 끌고, 아래쪽 가장자리를 끌어 길이를 바꾸고, 빈 칸을 끌어 추가 시트가 시간이 채워져 열리는지 확인. 리스트 탭의 손잡이 드래그도 한 번 확인.
- 실패 시 증상: 블록이 원위치로 튀어 돌아옴(저장 실패 토스트), 터치에서 스크롤만 됨(길게 눌러야 드래그됨이 정상).

### [M6~M8] 체크리스트·비용·정산 화면 눈 확인 (UNVERIFIED: 브라우저 자동 검증 안 함)
- 필요 단계: M6, M7, M8 (약 15분, 시크릿 창 2개)
- 방법: (1) 체크리스트 템플릿 추가 → 한쪽에서 체크하면 다른 창에 1~2초 안에 반영·홈 게이지 갱신. (2) 지출 추가에서 `점심 스시 1480엔 카드` 입력 → 칩 자동 채움, 저장 후 목록/요약 반영. (3) 정산 탭에서 `정산` → 반대편 창에도 반영, `정산 취소`로 복구.
- 실패 시 증상: 지출 저장 시 `저장하지 못했어요` 토스트 = RPC 오류(콘솔 확인), 환율이 비어 있음 = `supabase functions serve` 미실행(오프라인이면 마지막 환율 사용).

### [M9] OpenRouter 크레딧 · 모델명 · 한도 설정 (UNVERIFIED)
- 필요 단계: M9 (약 10분)
- OpenRouter: 테스트 결과 HTTP 402(결제/크레딧 부족). openrouter.ai에서 크레딧을 충전하거나 무료 모델을 지정한 뒤 AI 설정 → 연결 테스트가 `연결됐어요`가 되는지 확인. 기본 모델 `google/gemini-2.5-flash`는 최신 이름이 아닐 수 있으니 `DEFAULT_OPENROUTER_MODEL`로 지정 권장.
- Gemini: 실제 호출 성공(모델은 ListModels로 자동 선택). 고정하려면 `supabase/functions/.env`에 `DEFAULT_GEMINI_MODEL=` 추가.
- 비용 보호: `supabase/functions/.env`에 `DAILY_LIMIT_AI=30` 추가(무인 모드에서는 이 파일 수정 금지라 직접 못 넣음, 기본값 60).
- Google 서버 키가 없어서 AI가 만든 장소는 "위치 미확인"(좌표 없음)으로 저장됨 → M4 항목의 `GOOGLE_SERVER_KEY` 입력 후 새로 생성하면 좌표가 채워지는지 확인.
- 실패 시 증상: 채팅에서 `AI 응답을 받지 못했어요` = 두 제공자 모두 실패(함수 로그: `supabase functions serve` 출력의 `ai-plan AI_FAILED`).

### [M10] 탐색 검색·실내 대안 눈 확인 (UNVERIFIED)
- 필요 단계: M10 (약 10분, Google 키 후)
- 방법: 탐색에서 장소명 입력 → 지금은 `직접 입력` 후보 1개만 보임. Google 키(M4 항목) 입력 후 `getPlacesProvider()`에 Google 구현을 연결하면 실제 후보가 나옴(코드는 PlacesProvider 인터페이스 뒤에 준비, 구현체 추가 필요 — BACKLOG). 일정 화면에서 Day 헤더 `실내로` 스위치 → 야외 장소의 `실내 대안` 칩 → 교체.
- 실패 시 증상: 실내 대안 시트에 `AI 응답을 받지 못했어요` = AI 키/한도 문제, 후보에 `위치 미확인` = GOOGLE_SERVER_KEY 없음.
