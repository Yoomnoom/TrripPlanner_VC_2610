# PROGRESS (무인 모드 진행 기록)

세션이 끊기면 CLAUDE.md → 이 파일 → docs/HUMAN_TODO.md 순서로 읽고 이어서 진행한다.
범위: SPEC M4→M12, 부록 F-6 M13→M19. 복구 지점은 `git tag autopilot-M{n}`.

- 2026-10-11 · M0~M3 완료(사용자 확인 포함). 0단계: `.claude/settings.json` 권한 설정. 다음: M4.
- 2026-10-11 · M4 완료: 일정 화면 리스트/지도 탭, Google 지도 구현(키 없으면 "키가 필요해요"+리스트 폴백, lazy), 번호 핀·Day 색·직선(점선)/실경로선·Day 필터·내 위치·전체화면·전체보기·길찾기 링크, `routes-leg` Edge Function(로컬 serve로 NO_KEY/400/401 확인), 클라이언트 GoogleRoutesProvider+폴백. 테스트 64개 통과, build OK. UNVERIFIED: 실제 Google 지도/Routes 응답. 다음: M5.
