# 최종 보고 (무인 모드, M4 → M19)

**상태:** SPEC M0~M19 전 단계 구현 완료. `typecheck`·`lint`(접근성 규칙 포함)·`vitest 217개`·`build`·`Playwright 스모크 6개(375px/1280px)` 통과. 단계마다 `autopilot-M{n}` 태그가 있어 어느 지점으로든 복구할 수 있어요.

## 완성된 것
- 여행 생성·초대 입장·멤버·공유 중지/재발급, 일정(리스트·캘린더·지도), 드래그 정렬+시간 재배치, 실시간 동기화
- 체크리스트·게이지, 비용(빠른 입력·환율·분담·요약 차트·CSV)·정산, 영수증·예약 자동 입력, 예약·자료
- AI 채팅·마법사·실내 대안·회고(Gemini/OpenRouter 자동 전환), 탐색·내 저장, 여행 정보(시차·날씨·환율), 여행 중 홈
- 발자취(세계·한국 시군 지도·통계 7종), 설정(내보내기/가져오기), 오프라인(캐시·쓰기 큐·오프라인 카드), 후기·읽기 전용 링크·복제

## 키 없이 우회한 것
- **Google 지도·Places·Routes:** 어댑터 뒤에 구현. 키가 없으면 지도 탭은 "키가 필요해요"+리스트, 장소 검색은 직접 입력(PlacesProvider), 이동 정보는 직선거리 추정(`~`). `VITE_GOOGLE_MAPS_BROWSER_KEY`를 넣으면 코드 수정 없이 켜져요.
- **AI:** 실제 Gemini로 시험했고, `AI_FAKE=1`로 키 없이도 채팅→제안→적용 흐름이 끝까지 동작해요.

## UNVERIFIED 목록
Google 지도/Routes/Places 실응답, OpenRouter(402), AI 회고 실호출(Gemini 429), 터치 드래그·캘린더 조작, 실제 영수증·예약 문서, 비행기 모드 실사용, 국가 기본 정보 공식 대조, `supabase functions deploy` 번들링. 상세는 `docs/HUMAN_TODO.md`.

## 알려진 문제
- Gemini가 간헐적으로 429/5xx를 돌려줘요(재시도·대기·자동 전환으로 완화, 한도는 계정 설정에 달림).
- OpenRouter 키는 크레딧이 없어 현재 402예요.
- 한국 내 도보·자동차 경로는 Google 제한으로 `~` 추정이에요. 오프라인에서는 지도 타일을 쓰지 않아요(약관).

## 아침에 할 일 (순서대로)
1. `docs/HUMAN_TODO.md`의 ① 키 입력(Google 결제·예산 알림 먼저, OpenRouter 크레딧, `DAILY_LIMIT_AI`)
2. ② Supabase 프로젝트·마이그레이션·함수·Vercel 배포
3. ③ UNVERIFIED 표를 위에서부터, 그리고 `docs/QA_CHECKLIST.md`의 ☐ 항목
