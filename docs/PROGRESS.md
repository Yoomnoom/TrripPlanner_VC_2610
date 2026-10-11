# PROGRESS (무인 모드 진행 기록)

세션이 끊기면 CLAUDE.md → 이 파일 → docs/HUMAN_TODO.md 순서로 읽고 이어서 진행한다.
범위: SPEC M4→M12, 부록 F-6 M13→M19. 복구 지점은 `git tag autopilot-M{n}`.

- 2026-10-11 · M0~M3 완료(사용자 확인 포함). 0단계: `.claude/settings.json` 권한 설정. 다음: M4.
- 2026-10-11 · M4 완료: 일정 화면 리스트/지도 탭, Google 지도 구현(키 없으면 "키가 필요해요"+리스트 폴백, lazy), 번호 핀·Day 색·직선(점선)/실경로선·Day 필터·내 위치·전체화면·전체보기·길찾기 링크, `routes-leg` Edge Function(로컬 serve로 NO_KEY/400/401 확인), 클라이언트 GoogleRoutesProvider+폴백. 테스트 64개 통과, build OK. UNVERIFIED: 실제 Google 지도/Routes 응답. 다음: M5.
- 2026-10-11 · M5 완료: 캘린더 탭(FullCalendar 6, 실제 날짜, 드래그·리사이즈·빈 칸 선택 추가, 카테고리 색, 시간 범위 자동 확장), 일정 CSV(수식 방어·BOM), 리스트/캘린더/지도가 같은 places 캐시 공유. 테스트 71개, build OK(캘린더 lazy chunk). 브라우저 드래그는 UNVERIFIED(HUMAN_TODO). 다음: M6.
- 2026-10-11 · M6 완료: 체크리스트(2섹션·템플릿 선택 추가·인라인 추가/수정/삭제·드래그 정렬·체크 낙관적+누가 체크했는지·Realtime), 진행률 게이지 2개, 홈 게이지+남은 준비 미리보기(홈에서 체크 가능). 테스트 78개, build OK. 다음: M7.
- 2026-10-12 · M7 완료: fx-rate 함수(실호출 확인)+오프라인 마지막 환율, 빠른 입력 파서, 지출 폼(균등/비율/금액 분담, 합계 검증), save_expense RPC로만 저장, 목록(검색·필터·CSV), 요약(보낼/받을/전체, 도넛2·막대·큰 지출·예산, recharts lazy), Realtime. 테스트 97개, API 스크립트로 RPC·fx 검증. 다음: M8.
- 2026-10-12 · M8 완료: 정산 탭(잔액 막대, 최소 송금 카드, 정산 확인 시트, 정산 완료/취소, Realtime). 부록 C-2 필수 케이스 6개는 tests/settlement.test.ts(8개)로 통과, 전체 97개. 다음: M9.
- 2026-10-12 · M9 완료: AI 어댑터(Gemini/OpenRouter)+runAi(재시도·자동 전환·zod 검증)+가짜 제공자, ai-status(키 불리언·연결 테스트·모델 자동 탐색), ai-plan(컨텍스트·환율/날씨 보강·Places 해석·chat_messages는 service_role 저장), 채팅 UI(제안 카드·diff·덮어쓰기/추가 적용·AI 설정 시트). 실호출: Gemini 성공(구조화 출력·일정 생성·적용), OpenRouter 402(계정 크레딧)→자동 전환 확인. 테스트 128개. 버그 수정: Realtime UPDATE가 큰 jsonb를 생략해 카드가 사라지던 문제(병합 처리), 일정 탭 3열. 다음: M10.
- 2026-10-12 · M10 완료: /explore(검색→PlacesProvider, 분류 칩, 상세 시트, Google/네이버/카카오 외부 링크, 아이디어 보관함·일정으로 이동), ai-indoor-swap 함수(실호출 성공, 비멤버 403)와 Day 헤더 실내 토글·교체 시트, 홈 카운트(일정/아이디어 분리). 테스트 133개. 다음: M11.
