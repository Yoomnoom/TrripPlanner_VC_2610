# CLAUDE.md — 개인용 여행 플래너

> 모든 작업의 기준 문서는 `docs/SPEC.md`다. 이 파일은 매 세션 시작 때 읽는 요약이다.

## 프로젝트
- 반응형 웹앱(PWA). React 18 + TypeScript(strict) + Vite, Tailwind + shadcn/ui, TanStack Query, Zustand, zod.
- 백엔드: Supabase (Postgres, Realtime, Storage, Edge Functions, 익명 로그인). 로그인 없이 초대 링크 + 닉네임으로 참여.
- AI: Gemini API / OpenRouter 둘 다 지원(설정에서 전환, 실패 시 자동 전환). 키는 Edge Function 시크릿에만.
- 지도·장소·경로: Google Maps Platform. 캘린더: FullCalendar. 차트: Recharts.
- 패키지 매니저: pnpm.

## 명령
```
pnpm dev | pnpm typecheck | pnpm lint | pnpm test | pnpm build
supabase start | supabase db reset | supabase functions serve
```

## 이미 완성되어 있어서 다시 쓰지 않는 것
- `supabase/migrations/0001~0003` — 스키마, RLS, 컬럼 권한, RPC, Storage. **수정 금지.** 변경은 `0004`부터 새 파일로.
- `supabase/tests/` — 권한 스모크 테스트와 기대 결과.
- `starter/` — `settlement`, `geo`, `time`, AI zod 스키마, `yearStreak`와 테스트. M0에서 `src/`로 옮긴다.

## 작업 규칙
1. `docs/SPEC.md` 6부(M0→M12)와 부록 F-6(M13→M19) 순서대로, 한 단계씩. 단계마다 `typecheck && lint && test` 통과 후 `feat(Mx): ...`로 커밋.
2. TypeScript strict, `any` 금지(불가피하면 이유를 주석으로). DB 타입은 `supabase gen types` 결과를 쓴다.
3. **비밀 키는 클라이언트 번들, 커밋, 로그에 넣지 않는다.** 클라이언트는 `VITE_` 공개 키(Supabase anon, 리퍼러 제한된 Maps 키)만. AI 키·Google 서버 키는 Edge Function 시크릿.
4. 모든 서버 입력과 AI 출력은 zod로 검증한다. AI 출력은 신뢰하지 않는다.
5. 지출은 **`save_expense` RPC로만** 저장한다(직접 insert/update 권한 없음). chat_messages 생성은 Edge Function(service_role)만.
6. service_role 클라이언트는 사용량 카운트(`bump_usage`)와 chat_messages 저장에만 쓴다. 그 외는 사용자 JWT로 RLS를 따른다.
7. 외부 API 응답 형식과 모델 이름은 추측하지 말고 공식 문서나 실제 호출로 확인한다. 확인이 안 되면 어댑터 뒤에 두고 오류 처리와 폴백을 구현한다.
8. 낙관적 업데이트 + 실패 시 롤백 토스트. Realtime 이벤트로 Query 캐시를 갱신(전체 refetch 금지).
9. UI 문구는 한국어, 짧은 존댓말("~했어요"), `src/copy.ts`에 모은다. 코드·커밋·변수명은 영어.
10. 접근성: 아이콘 버튼 `aria-label`, 모달 포커스 트랩, 색만으로 상태 구분 금지, 터치 영역 44px 이상.
11. 순수 로직(`settlement`, `time`, `geo`, `money`, `csv`, 발자취 통계)은 vitest 테스트 필수.
12. 새 의존성은 이유를 커밋 본문에 쓴다. 큰 번들(발자취 지도, 캘린더, 차트)은 라우트 단위 lazy 로드.
13. 돈이 드는 설정(Google Cloud 결제, 유료 AI), 계정·키 발급, 배포 연결이 필요한 지점에서는 멈추고 사용자에게 방법을 안내한다. 키를 대화에 붙여넣게 하지 않는다.
14. 문서와 다르게 구현할 때는 `docs/DECISIONS.md`에 이유를 한 줄로 남긴다.
15. 사용자와는 한국어로 소통하고, 단계 보고는 10줄 이내로 짧게.

## 알려진 주의점
- Google Routes는 한국 내 도보·자동차 경로가 제한된다 → 실패하면 직선거리 기반 추정치로 폴백하고 `~`로 표시(SPEC 4-7).
- react-simple-maps는 React 18 기준. React 19로 올리지 않는다.
- 구글 지도 타일은 오프라인 캐시하지 않는다(약관). 오프라인 카드는 좌표·현지어 주소 목록으로 대체(SPEC F-3-4).
- 비자·입국 규정은 직접 서술하지 않고 공식 링크로만 안내한다(SPEC F-3-3).
