### 발견사항

- **[WARNING]** `getPublicState` 응답에 `isAI` 필드 추가 — 기존 클라이언트 영향 미미하나 비문서화 필드 증가
  - 위치: `game.service.ts:196`, `frontend/src/lib/types.ts`
  - 상세: `PlayerPublicState.isAI`가 optional(`?`)로 추가되어 하위 호환성은 유지되나, 프론트엔드 타입은 `isAI?: boolean`으로 선언된 반면 서버는 항상 `isAiPlayer()` 결과(boolean)를 전송하여 타입 계약이 불일치
  - 제안: 서버 응답 타입을 `isAI: boolean`으로 고정하거나, 프론트엔드에서도 non-optional로 통일

- **[WARNING]** `getActionRequired` 응답에 `isDraw` 필드 추가 — 클라이언트 미처리 시 무시됨
  - 위치: `game.service.ts:229-237`
  - 상세: 드로우 페이즈에서 `isDraw: true`를 반환하지만, 프론트엔드 `ActionRequired` 타입에 `isDraw` 필드가 정의되어 있지 않아 타입 계약 누락
  - 제안: `frontend/src/lib/types.ts`의 `ActionRequired` 인터페이스에 `isDraw?: boolean` 추가

- **[WARNING]** `getGameResult` 응답 구조 변경 — DB 기반 → 인메모리 기반으로 교체
  - 위치: `game.service.ts:319-371`
  - 상세: 기존에는 DB의 `GameParticipant` 레코드에서 결과를 조회했으나, 이제 인메모리 상태를 직접 사용. AI 플레이어가 포함된 결과(`isAI: true`)가 `GAME_ENDED` 이벤트로 클라이언트에 전달되며, 기존 클라이언트가 `isAI` 필드를 처리하지 못할 경우 UI 렌더링 이슈 가능
  - 제안: `GameEndResult` 타입에 `isAI?: boolean`이 추가되었으므로 클라이언트에서 AI 플레이어 필터링 로직 명시적 추가 권고

- **[INFO]** `startGame` 메서드 시그니처 변경 (`aiPlayers` 파라미터 추가)
  - 위치: `game.service.ts:46`
  - 상세: 내부 서비스 메서드이나 기본값 `[]`로 하위 호환 유지됨. 직접 호출하는 `room.gateway.ts`는 올바르게 업데이트됨
  - 제안: 이상 없음

- **[INFO]** Hall of Fame 랭킹 쿼리에 `ai-%` 필터 추가
  - 위치: `hall-of-fame.service.ts:56, 87`
  - 상세: `NOT LIKE 'ai-%'` 하드코딩. `ai-names.ts`의 `AI_UUID_PREFIX` 상수와 동기화되지 않아 prefix 변경 시 쿼리 누락 위험
  - 제안: 상수를 공유하거나 쿼리 파라미터로 바인딩: `.andWhere('gp.playerUuid NOT LIKE :prefix', { prefix: 'ai-%' })`

- **[INFO]** `checkAllReady` 조건 변경 (`< 2` → `< 1`)
  - 위치: `room.service.ts:278`
  - 상세: 단독 플레이어도 게임 시작 가능하도록 변경. API 계약상 breaking change는 아니나 게임 로비 동작이 변경됨. 클라이언트 UI에서 "최소 2명 필요" 안내 문구가 있다면 업데이트 필요
  - 제안: 프론트엔드 대기실 UI에서 준비완료 조건 안내 문구 동기화 확인

### 요약

이번 변경은 AI 플레이어 기능을 추가하기 위한 것으로, REST API 엔드포인트 자체는 변경되지 않았고 WebSocket 이벤트 페이로드에 `isAI` 필드가 추가되었습니다. optional 필드로 추가되어 하위 호환성은 대체로 유지되나, `isDraw` 필드가 프론트엔드 타입에 누락되어 있고, Hall of Fame 필터의 prefix 하드코딩, `getGameResult`의 AI 결과 포함 등 일부 타입 계약 불일치와 유지보수 위험 요소가 존재합니다. 전반적으로 심각한 breaking change는 없으나 타입 동기화 보완이 필요합니다.

### 위험도
LOW