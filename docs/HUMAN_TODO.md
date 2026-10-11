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
