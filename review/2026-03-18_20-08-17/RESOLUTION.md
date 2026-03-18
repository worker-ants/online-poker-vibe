# 코드 리뷰 조치 내용

## 조치 완료

### WARNING #1: `RoomState.settings` 백엔드 계약 미검증
- **확인 결과**: 백엔드 `getRoomState()` (room.service.ts:268)에서 `settings: room.getSettings()`를 이미 포함하여 응답. ROOM_UPDATED, ROOM_JOIN 이벤트 모두 이 메서드를 통해 전달되므로 non-optional이 정확함.
- **조치 불필요**

### WARNING #3, #4, INFO #9, #10: 테스트 보완
- `five-card-draw` 변형 테스트 추가
- `ante: 0` 경계값 테스트 추가
- `blindSchedule: []` 빈 배열 테스트 추가
- 블라인드 스케줄 토글 재닫기 테스트 추가

### INFO #1: `showSchedule` 타입 명확화
- `(settings.blindSchedule?.length ?? 0) > 0`으로 boolean 반환 보장

### INFO #2: non-null assertion 제거
- `settings.ante!` → `settings.ante ?? 0` (optional chaining + nullish coalescing)
- `settings.blindSchedule!.map` → `settings.blindSchedule?.map` (optional chaining)

### INFO #3: `formatNumber` 로케일 고정
- `toLocaleString()` → `new Intl.NumberFormat('en-US')` 모듈 스코프 인스턴스로 변경
- CI 환경 로케일 독립성 확보 + 반복 호출 성능 개선

### INFO #4: `GameRulesPanel` props 인터페이스 분리
- `RoomState` 전체 대신 `variant`, `mode`, `settings` 3개 필드만 props로 수신하도록 변경
- ISP 원칙 준수, 불필요한 리렌더 방지

### INFO #6: `formatNumber` 성능 개선
- 모듈 스코프 `Intl.NumberFormat` 인스턴스 재사용 (위 #3과 동시 해결)

## 미조치 (선택 사항)

### WARNING #2: `CreateRoomDto.settings` 세부 유효성 검증
- 이번 변경 범위 밖 (기존 이슈). 별도 작업으로 처리 예정.

### INFO #5: `VARIANT_LABELS`, `MODE_LABELS` 상수 분리
- 기존 코드 전반에서 `types.ts`에서 import하는 패턴이 확립되어 있어, 이번 변경에서는 유지.

### INFO #7: 한/영 라벨 혼용
- 포커 전문 용어(Blinds, Ante, Blind Schedule)는 영어, 일반 용어(게임 종류, 게임 모드, 시작 칩)는 한국어로 사용. 의도된 구성.

### INFO #8: `roomId` FK 인덱스
- 이번 변경 범위 밖 (기존 이슈). 별도 작업으로 처리 예정.

### INFO #11: 스펙 문서 "변경 파일" 섹션
- 구현 참고용으로 유지.
