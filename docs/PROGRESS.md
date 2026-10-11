# PROGRESS (무인 모드 진행 기록)

세션이 끊기면 CLAUDE.md → 이 파일 → docs/HUMAN_TODO.md 순서로 읽고 이어서 진행한다.
범위: SPEC M4→M12, 부록 F-6 M13→M19. 복구 지점은 `git tag autopilot-M{n}`.

- 2026-10-11 · M0~M3 완료(사용자 확인 포함). 0단계: `.claude/settings.json` 권한 설정. 다음: M4.
- 2026-10-11 · M4 완료: 일정 화면 리스트/지도 탭, Google 지도 구현(키 없으면 "키가 필요해요"+리스트 폴백, lazy), 번호 핀·Day 색·직선(점선)/실경로선·Day 필터·내 위치·전체화면·전체보기·길찾기 링크, `routes-leg` Edge Function(로컬 serve로 NO_KEY/400/401 확인), 클라이언트 GoogleRoutesProvider+폴백. 테스트 64개 통과, build OK. UNVERIFIED: 실제 Google 지도/Routes 응답. 다음: M5.
- 2026-10-11 · M5 완료: 캘린더 탭(FullCalendar 6, 실제 날짜, 드래그·리사이즈·빈 칸 선택 추가, 카테고리 색, 시간 범위 자동 확장), 일정 CSV(수식 방어·BOM), 리스트/캘린더/지도가 같은 places 캐시 공유. 테스트 71개, build OK(캘린더 lazy chunk). 브라우저 드래그는 UNVERIFIED(HUMAN_TODO). 다음: M6.
- 2026-10-11 · M6 완료: 체크리스트(2섹션·템플릿 선택 추가·인라인 추가/수정/삭제·드래그 정렬·체크 낙관적+누가 체크했는지·Realtime), 진행률 게이지 2개, 홈 게이지+남은 준비 미리보기(홈에서 체크 가능). 테스트 78개, build OK. 다음: M7.
