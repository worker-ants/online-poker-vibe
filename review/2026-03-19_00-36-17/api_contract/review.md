### 발견사항

- **[WARNING]** `GamePhase` 타입 불일치 — 프론트엔드에만 `'pre-deal'` 존재
  - 위치: `frontend/src/lib/types.ts` vs `backend/src/common/types/game.types.ts`
  - 상세: 프론트엔드의 `GamePhase`에 `'pre-deal'`이 포함되어 있으나, 백엔드의 `HoldemPhase | DrawPhase | StudPhase`에는 해당 단계가 없음. 백엔드가 이 값을 절대 전송하지 않으므로 dead code이며, 실제 서버 페이즈와 프론트엔드 타입 간 신뢰도를 낮춤
  - 제안: 프론트엔드에서 `'pre-deal'` 제거, 또는 백엔드에 해당 페이즈 추가

- **[WARNING]** `ActionRequired.isDraw` 필드가 프론트엔드 타입에서 누락
  - 위치: `backend/src/common/types/game.types.ts:149` vs `frontend/src/lib/types.ts`
  - 상세: 백엔드 `ActionRequired`에 `isDraw?: boolean`이 있으나 프론트엔드 타입에 미반영. Five Card Draw의 드로우 단계에서 서버가 이 필드를 전송해도 프론트엔드 `BettingControls`가 이를 처리하지 못함
  - 제안: 프론트엔드 `ActionRequired` 인터페이스에 `isDraw?: boolean` 추가 및 `BettingControls`에서 드로우 UI 분기 처리

- **[WARNING]** `Card.rank` 타입 불일치 — 프론트엔드 `string` vs 백엔드 `Rank` 유니온
  - 위치: `frontend/src/lib/types.ts:8` vs `backend/src/common/types/card.types.ts:2`
  - 상세: 프론트엔드가 `rank: string`으로 선언하여 타입 안전성 없음. 백엔드가 `'2'~'A'` 범위 밖의 rank를 전송해도 컴파일 타임에 감지 불가
  - 제안: `rank: '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'`로 강타입화

- **[WARNING]** `GameHistoryEntry`의 `variant`, `mode`, `result` 필드가 `string` 타입 — 타입 안전성 부재
  - 위치: `frontend/src/lib/types.ts`, `frontend/src/components/hall-of-fame/PlayerHistoryModal.tsx`
  - 상세: API에서 받은 값을 UI에서 `game.variant as PokerVariant`로 강제 캐스팅 중. 백엔드가 예상 외 값을 전송 시 런타임 오류 발생 가능
  - 제안: `variant: PokerVariant`, `mode: GameMode`, `result: GameResult`로 타입 강화

- **[WARNING]** `RoomState`에 `settings` 필드가 프론트엔드 타입상 required이나 테스트에서 누락
  - 위치: `frontend/src/hooks/useGameStore.spec.ts:36, 49, 63`
  - 상세: `RoomState` 인터페이스에서 `settings: RoomSettings`가 필수 필드이나 테스트 픽스처에 해당 필드 없음. 타입 오류가 테스트에서 억제되고 있거나 런타임 undefined 접근 위험
  - 제안: 테스트 픽스처에 `settings` 필드 추가, 또는 `settings`를 optional로 변경하고 서버 응답 여부 확인

- **[INFO]** `PlayerPublicState.isAI` — 백엔드 required, 프론트엔드 optional
  - 위치: `backend/src/common/types/game.types.ts:106` vs `frontend/src/lib/types.ts:53`
  - 상세: 필드 존재 여부 불일치. 현재는 문제없으나 향후 `isAI`를 기반으로 프론트엔드 로직이 확장될 경우 undefined 처리 누락 가능
  - 제안: 프론트엔드에서 `isAI: boolean`으로 통일

- **[INFO]** `GameEndPlayerResult.placement` — 백엔드 required, 프론트엔드 optional
  - 위치: `backend/src/common/types/game.types.ts:113` vs `frontend/src/lib/types.ts:73`
  - 상세: 백엔드는 항상 `placement: number`를 포함하여 전송하지만 프론트엔드는 optional로 처리. 불필요한 null 체크 분기 발생
  - 제안: 프론트엔드에서 `placement: number`로 변경

- **[INFO]** Room List 및 Hall of Fame API에 페이지네이션 부재
  - 위치: `frontend/src/hooks/useRoomList.ts`, `frontend/src/components/hall-of-fame/RankingsTable.tsx`
  - 상세: 방 목록과 랭킹 데이터를 전량 수신. 데이터 증가 시 성능 저하 위험
  - 제안: 단기적으로는 서버에서 최대 N개 제한, 장기적으로는 페이지네이션 도입

- **[INFO]** API 버전 관리 전략 부재
  - 위치: `frontend/src/lib/constants.ts`, `backend/src/common/types/events.types.ts`
  - 상세: WebSocket 이벤트명에 버전 정보 없음 (예: `room:list` vs `v1/room:list`). 계약 변경 시 하위 호환성 관리 어려움
  - 제안: 현재 규모에서는 허용 가능하나, 프로토콜 변경 시 버전 필드 도입 검토

---

### 요약

전반적인 WebSocket 이벤트 이름은 프론트엔드와 백엔드 간에 정확히 일치하며 계약 자체는 안정적으로 관리되고 있습니다. 그러나 공유 타입 정의가 각각 독립적으로 유지되면서 `GamePhase`의 `pre-deal` 추가, `ActionRequired.isDraw` 누락, `Card.rank`의 느슨한 타입, `GameHistoryEntry`의 unsafe 캐스팅 등 점진적인 불일치가 축적되고 있습니다. 특히 `isDraw` 누락은 Five Card Draw 드로우 단계에서 UI가 올바르게 동작하지 않을 수 있는 실질적 기능 결함입니다. 단일 소스 오브 트루스(공유 타입 패키지 또는 OpenAPI/AsyncAPI 스키마 자동생성)를 도입하면 이러한 드리프트를 구조적으로 방지할 수 있습니다.

### 위험도
**MEDIUM**