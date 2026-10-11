# BACKLOG (범위 밖 아이디어 — 구현하지 않음)

- Google PlacesProvider 구현체(자동완성·상세·사진): 키 발급 후 `src/providers/places.ts`의 getPlacesProvider에 연결 (M3/M10 인터페이스는 준비됨)
- 일정 상단 "고정 일정" 배너(항공/숙소 예약 표시): lib/reservations.ts의 isFixedItem 준비됨, UI 미구현
- 새 여행 생성 시 목적지 도시와 일치하는 내 저장 장소를 "아이디어로 가져올까요?" 제안 (SPEC F-3-5 ①): 현재는 탐색의 `내 저장에서 가져오기`로만 가능
- /saved 지도 보기: Google 키 이후
- 일정 지도에서 "근처 보기"(F-3-10): Google Places Nearby 필요
- 오프라인 중 장소 추가/이동 같은 일정 구조 변경 큐잉(충돌 해소 필요): 현재는 오프라인에서 비활성(롤백+안내)
