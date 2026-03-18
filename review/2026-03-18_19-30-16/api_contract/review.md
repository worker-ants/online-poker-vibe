### 발견사항

- **[INFO]** `leaveRoom` 내부 로직 변경이 관련 API 동작에 영향
  - 위치: `room.service.ts:180-198`
  - 상세: 마지막 플레이어 퇴장 시 Game/GameParticipant 레코드를 명시적으로 삭제하는 로직이 추가되었습니다. `leaveRoom`의 반환 타입(`Promise<void>`)과 WebSocket 이벤트 시그니처는 변경되지 않아 클라이언트 입장에서의 계약은 유지됩니다. 그러나 Room 삭제 시 연관 Game 데이터도 함께 제거되므로, 이후 Hall of Fame API(`GET /hall-of-fame` 등)가 해당 데이터를 참조하는 경우 결과가 달라질 수 있습니다.
  - 제안: 현재 Hall of Fame가 Room 삭제 시점에 Game 기록을 참조하는 엔드포인트가 있다면, 해당 동작 변경을 API 문서에 명시하거나 삭제 전 게임 결과를 별도 아카이브 처리하는 방식을 고려하세요.

- **[INFO]** `onDelete: 'CASCADE'` 추가는 DB 레벨 변경
  - 위치: `game-participant.entity.ts:37,41`, `game.entity.ts:41`
  - 상세: 외래 키 CASCADE 설정은 DB 스키마 변경이며 API 계약에는 직접 영향을 주지 않습니다. 단, 기존에 수동으로 처리하던 삭제 로직과 이중으로 작동할 수 있습니다. `room.service.ts`에서 `participantRepository.delete()`를 명시적으로 호출한 뒤 `gameRepository.remove()`를 호출하고 있는데, Game 삭제 시 `onDelete: 'CASCADE'`가 이미 GameParticipant를 제거하므로 중복 처리입니다.
  - 제안: `onDelete: 'CASCADE'`를 신뢰한다면 `participantRepository`의 명시적 삭제를 제거하거나, CASCADE를 제거하고 명시적 삭제만 유지하는 방향으로 통일하세요.

- **[INFO]** `Card.tsx` 색상 변경은 API와 무관한 UI 수정
  - 위치: `frontend/src/components/cards/Card.tsx:22-23`
  - 상세: 클럽/스페이드 색상 `text-white` → `text-gray-900` 변경은 순수 시각적 버그 수정으로 API 계약과 무관합니다.

---

### 요약

이번 변경사항은 DB 외래 키 CASCADE 설정, 룸 삭제 시 연관 Game 레코드 정리, 카드 UI 색상 수정으로 구성되어 있습니다. REST 엔드포인트의 경로, 요청/응답 구조, WebSocket 이벤트 시그니처에는 변경이 없어 API 클라이언트 측 호환성은 유지됩니다. 다만 Room 삭제 시 Game 기록이 함께 삭제되는 부수 효과가 Hall of Fame 등 게임 이력 조회 API의 데이터 정합성에 영향을 줄 수 있으며, CASCADE와 명시적 삭제 로직이 중복으로 존재하는 점은 정리가 필요합니다.

### 위험도
LOW