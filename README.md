# 개인용 여행 플래너

동행과 같이 쓰는 반응형 웹앱(PWA)입니다. 로그인 없이 **초대 링크 + 닉네임**으로 참여하고, 일정·지도·비용 정산·체크리스트·AI 채팅·발자취를 한곳에서 다룹니다.

- 프런트: React 18 + TypeScript(strict) + Vite, Tailwind, TanStack Query, Zustand, zod
- 백엔드: Supabase (Postgres·RLS, Realtime, Storage, Edge Functions, 익명 로그인)
- AI: Gemini / OpenRouter (설정에서 전환, 실패 시 자동 전환), 키는 Edge Function 시크릿에만
- 지도·장소·경로: Google Maps Platform (키가 없으면 해당 자리에 "키가 필요해요"와 대체 화면)
- 기준 문서: `docs/SPEC.md` · 진행 기록: `docs/PROGRESS.md` · 내가 할 일: `docs/HUMAN_TODO.md` · 최종 보고: `docs/FINAL_REPORT.md`

## 빠른 시작 (로컬)

필요한 것: Node 20+, Docker(로컬 Supabase용), pnpm 11 (`npx pnpm@11.16.0 …`로도 실행 가능)

```bash
pnpm install
pnpm exec supabase start            # 로컬 Postgres 17 + Auth + Realtime + Storage (마이그레이션 0001~0003 자동 적용)
pnpm exec supabase status -o env    # API_URL, ANON_KEY 확인
```

`.env.local`을 만들어 공개 값만 넣습니다 (이 파일은 git에 올라가지 않습니다).

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<supabase status의 ANON_KEY>
# 아래는 선택: 넣으면 코드 수정 없이 기능이 켜집니다
VITE_GOOGLE_MAPS_BROWSER_KEY=
VITE_GOOGLE_MAP_ID=
```

```bash
pnpm exec supabase functions serve  # Edge Functions (AI·환율·경로). 시크릿은 supabase/functions/.env
pnpm dev                            # http://localhost:5173
```

## 명령

| 명령 | 설명 |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm preview` | 개발 서버 / 프로덕션 빌드(타입체크 포함) / 빌드 미리보기 |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | 타입체크 / 린트(접근성 규칙 포함) / 단위 테스트(vitest) |
| `pnpm e2e` | Playwright 스모크 (설치된 Chrome 사용, 로컬 Supabase 필요) |
| `pnpm exec supabase db reset` | 로컬 DB 초기화 후 마이그레이션 재적용 |
| `pnpm exec supabase gen types typescript --local > src/types/db.ts` | DB 타입 재생성 |

## 키와 시크릿 — 어디에 넣나

| 값 | 위치 | 비고 |
|---|---|---|
| Supabase URL / anon key | `.env.local` (`VITE_*`) | 공개 가능 |
| Google 브라우저 키, Map ID | `.env.local` (`VITE_GOOGLE_*`) | **HTTP 리퍼러 제한** + Maps JavaScript / Places API (New)만 허용 |
| Google 서버 키 `GOOGLE_SERVER_KEY` | Edge Function 시크릿 | Places API (New) + Routes API만 허용 (API 제한) |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY` | Edge Function 시크릿 | 둘 다 넣으면 자동 전환, 하나만 넣어도 동작 |
| `DEFAULT_GEMINI_MODEL` 등 | Edge Function 시크릿 | 비우면 현재 모델을 ListModels로 자동 선택 |
| `DAILY_LIMIT_AI` 등 | Edge Function 시크릿 | 사용자별 일일 호출 한도(비용 보호) |

로컬은 `supabase/functions/.env`, 배포는 `supabase secrets set KEY=VALUE`로 설정합니다. **키를 코드·채팅·커밋에 넣지 마세요.**

> **Google 비용 주의:** Maps Platform은 결제 계정 등록이 필요합니다. 키를 만들기 전에 Cloud Console → 결제 → 예산 및 알림에서 **월 예산 알림(예: $10, $30)** 을 먼저 설정하세요. API 제한(키마다 허용 API 지정)과 리퍼러 제한도 꼭 거세요.

## 구조

```
src/
  app/            라우터, Provider(쿼리 영속화·세션), 오프라인 배너, 에러 화면
  features/       화면별 코드 (trips, plan, expenses, checklist, chat, explore, reservations, files,
                  info, footprints, saved, recap, share, offline, reviews, home, settings)
  lib/            순수 로직(정산·시간·지오·CSV·오프라인 큐 …)과 클라이언트 유틸  ← 테스트 대상
  providers/      PlacesProvider / RoutesProvider (Google 구현을 꽂는 자리)
  copy.ts         모든 UI 문구(한국어)
supabase/
  migrations/     0001~0003 (수정 금지, 변경은 0004부터)
  functions/      ai-plan ai-status ai-indoor-swap ai-receipt ai-reservation ai-recap routes-leg fx-rate + _shared
  tests/          권한 스모크 테스트(rls_smoke.sql)와 기대 결과
tests/ e2e/       vitest 단위 테스트 / Playwright 스모크
public/geo/       세계·한국 지도 데이터 (출처·라이선스: public/geo/README.md)
```

## 배포 (사람이 직접 — 자동으로 하지 않습니다)

1. Supabase 프로젝트 생성 → Authentication에서 **Anonymous sign-ins 활성화**(가능하면 Captcha) → `supabase link` → `supabase db push` → `supabase functions deploy` → `supabase secrets set …`
2. Vercel(또는 Cloudflare Pages) 프로젝트 연결 → 환경변수(`VITE_*`) 입력 → 배포. `vercel.json`이 SPA 라우팅과 서비스 워커 캐시 헤더를 처리합니다.
3. 배포 도메인을 Google 키 **리퍼러 제한**, Supabase `site_url`·추가 리다이렉트, Edge Function `APP_BASE_URL`(CORS)에 추가합니다.
4. 상세 절차와 확인 방법은 `docs/HUMAN_TODO.md`의 최종 체크리스트를 따르세요.

## 알아둘 점

- 초대 링크를 아는 사람은 누구나 입장할 수 있습니다. 링크가 새면 `공유 중지`/재발급으로 막으세요. 여권 사본 같은 민감 파일은 자료로 올리지 마세요.
- 한국 내 도보·자동차 경로는 Google 제한으로 추정(`~`) 시간이 표시될 수 있습니다.
- 구글 지도 타일은 오프라인으로 저장하지 않습니다(약관). 오프라인에서는 좌표·주소 목록과 길찾기 링크를 씁니다.
- 비자·입국 규정은 직접 서술하지 않고 공식 링크로만 안내합니다.
- 지리 데이터: world-atlas(ISC), 통계청 행정구역 경계 2013("Free to share or remix"). 상업 배포 시 재확인하세요.
