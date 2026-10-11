// All user-facing UI strings live here (Korean, short polite tone).
export const APP_NAME = 'Trip Planner';

export const copy = {
  common: {
    loading: '불러오는 중이에요',
    retry: '다시 시도',
    close: '닫기',
    comingSoon: '곧 만들어질 화면이에요',
  },
  session: {
    envMissing: '.env.local에 Supabase 주소와 키를 먼저 넣어 주세요',
    failed: '접속하지 못했어요. 잠시 후 다시 시도해 주세요',
  },
  routes: {
    home: '내 여행',
    newTrip: '새 여행',
    join: '초대 입장',
    tripHome: '여행 홈',
    chat: 'AI 채팅',
    plan: '일정',
    explore: '탐색',
    reservations: '예약',
    files: '자료',
    checklist: '체크리스트',
    expenses: '비용',
    members: '동행',
    footprints: '발자취',
    settings: '설정',
    notFound: '페이지를 찾을 수 없어요',
  },
} as const;