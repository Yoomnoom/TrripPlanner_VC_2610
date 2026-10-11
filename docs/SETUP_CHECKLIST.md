# 사람이 직접 해야 하는 준비

Claude Code가 해당 단계에 도달하면 이 목록에서 필요한 항목을 안내합니다. 미리 해두면 중간에 멈추지 않습니다.
**키는 채팅에 붙여넣지 말고** `.env.local` 또는 `supabase secrets set`으로만 넣으세요.

## 0. 내 PC (M0 전에)
- [ ] Node.js 20 이상, pnpm, git
- [ ] Docker Desktop (로컬 Supabase용. 클라우드 Supabase만 쓸 거면 생략 가능)
- [ ] Supabase CLI
- [ ] Claude Code 설치 후 이 폴더에서 실행

## 1. Supabase (M1)
- [ ] https://supabase.com 에서 프로젝트 생성 (리전은 가까운 곳)
- [ ] 프로젝트 URL, anon key 확인 → `.env.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Authentication 설정에서 **Anonymous sign-ins 활성화** (클라우드: 대시보드, 로컬: `supabase/config.toml`의 `[auth]` 섹션 — 키 이름은 공식 문서로 확인)
- [ ] (선택) 익명 로그인 남용 방지용 Captcha

## 2. Google Cloud (M3~M4, 지도를 처음 쓰는 단계)
- [ ] 프로젝트 생성, **결제 계정 연결** (무료 크레딧 범위 안에서 쓰더라도 등록 필요)
- [ ] **예산 알림 설정** (예: 월 $10, $30 — 꼭 먼저)
- [ ] API 사용 설정: Maps JavaScript API, Places API (New), Routes API
- [ ] **키 2개 발급**
  - 브라우저용: HTTP 리퍼러 제한(내 도메인과 localhost) + API 제한(Maps JS, Places API (New))
  - 서버용: API 제한(Places API (New), Routes API). Edge Function 전용
- [ ] Map ID 생성 → `VITE_GOOGLE_MAP_ID`

## 3. AI 키 (M9)
- [ ] Gemini API 키 (Google AI Studio)
- [ ] OpenRouter API 키
- [ ] 둘 중 하나만 넣어도 동작하고, 둘 다 넣으면 실패 시 자동 전환
- [ ] `supabase secrets set GEMINI_API_KEY=... OPENROUTER_API_KEY=... GOOGLE_SERVER_KEY=...`

## 4. 지리 데이터 (M12, 발자취)
- [ ] 세계 지도 TopoJSON(world-atlas의 countries-110m)과 한국 시·군·구 경계 GeoJSON 내려받기 → `public/geo/`
- [ ] 라이선스·출처를 README에 기록 (Claude Code가 안내)

## 5. 배포 (M19)
- [ ] Vercel 또는 Cloudflare Pages 프로젝트 연결, 환경변수 입력
- [ ] 배포 도메인을 Google 브라우저 키의 리퍼러 제한과 Supabase 설정(site url, CORS)에 추가
- [ ] Edge Function 배포: `supabase functions deploy`
