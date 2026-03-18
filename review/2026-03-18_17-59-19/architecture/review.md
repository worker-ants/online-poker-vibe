### 발견사항

- **[WARNING]** AI 플레이어 상태가 Gateway에 저장됨 (단일 책임 위반)
  - 위치: `room.gateway.ts` - `aiPlayersMap`
  - 상세: `RoomGateway`(프레젠테이션 레이어)가 AI 플레이어 상태(`aiPlayersMap`)를 직접 관리함. Gateway는 WebSocket 이벤트 라우팅만 담당해야 하는데, 게임 세션 상태를 함께 보유하고 있어 책임이 혼재됨.
  - 제안: `aiPlayersMap`을 `RoomService` 또는 별도 `GameSessionService`로 이전하고, Gateway는 서비스 호출만 수행.

- **[WARNING]** AI 식별이 문자열 prefix 패턴에 의존 (취약한 추상화)
  - 위치: `ai-names.ts:isAiPlayer`, `hall-of-fame.service.ts` SQL 조건
  - 상세: `uuid.startsWith('ai-player-')` 패턴이 서비스 레이어(GameService, HallOfFameService)와 DB 쿼리에 모두 노출됨. 특히 `NOT LIKE 'ai-%'` SQL 하드코딩은 DB 레이어에 도메인 개념이 직접 침투한 구조.
  - 제안: `isAiPlayer(uuid)` 함수 호출은 수용 가능하나, SQL 쿼리의 문자열 패턴은 상수(`AI_UUID_PREFIX`)를 TypeORM 파라미터 바인딩으로 사용하도록 변경: `.andWhere('gp.playerUuid NOT LIKE :prefix', { prefix: AI_UUID_PREFIX + '%' })`

- **[WARNING]** `processAiTurnsOrNotify`가 `while(true)` 루프 + 비동기 블로킹
  - 위치: `room.gateway.ts:processAiTurnsOrNotify`
  - 상세: AI가 연속으로 행동하는 동안 이벤트 루프를 점유. 플레이어 전체가 AI인 극단적 경우 또는 AI 로직 버그(무한 액션)시 서버 행 위험. Gateway 메서드가 비즈니스 로직(AI 의사결정 + 게임 상태 전이)을 직접 수행하고 있어 레이어 책임이 과도하게 집중됨.
  - 제안: AI 턴 처리를 `GameService`로 위임하고, Gateway는 결과 브로드캐스트만 담당. 루프 내 최대 반복 횟수 가드 추가.

- **[INFO]** `getGameResult`에서 DB 조회 제거로 메모리 상태와 DB 불일치 가능성
  - 위치: `game.service.ts:getGameResult`
  - 상세: 기존 DB 기반 조회에서 인메모리 상태 기반으로 변경되어 일관성은 향상됐지만, `finishGame` 트랜잭션 완료 전에 `getGameResult`가 호출되는 경쟁 조건에서 결과가 DB에 반영되지 않은 상태로 전송될 수 있음.
  - 제안: `finishGame` → `getGameResult` 순서를 `handleAction` 내에서 순차 보장. 현재 코드는 이미 그렇게 되어 있으나, 주석으로 명시적 순서 문서화 권장.

- **[INFO]** `AiPlayerService.decideAction` 시그니처가 `variant`와 `gameState.variant` 중복
  - 위치: `ai-player.service.ts:decideAction`
  - 상세: `variant` 파라미터를 별도로 받지만 `gameState.variant`로도 접근 가능. `room.gateway.ts`에서도 `gameState.variant`를 직접 전달하고 있어 불필요한 파라미터임.
  - 제안: `variant` 파라미터 제거 후 내부에서 `gameState.variant` 사용.

- **[INFO]** `checkAllReady` 최소 인원 조건 변경이 도메인 의도를 숨김
  - 위치: `room.service.ts:checkAllReady`
  - 상세: `< 2`를 `< 1`로 변경한 것은 "AI가 나머지를 채운다"는 비즈니스 규칙을 단순 숫자 변경으로 표현. 코드만 읽으면 0명 방지 조건처럼 보임.
  - 제안: 주석 추가 또는 메서드명을 `canStartWithAI` 등으로 재고.

---

### 요약

AI 플레이어 기능 추가는 스펙에 맞게 기능적으로 잘 구현되었으나, 아키텍처 관점에서 두 가지 핵심 문제가 있다. 첫째, `RoomGateway`가 `aiPlayersMap` 상태 관리 + AI 의사결정 실행 + 브로드캐스트를 모두 수행하며 지나치게 비대해졌다(SRP 위반). 둘째, AI 식별 방식(`ai-` prefix)이 서비스 레이어와 SQL 쿼리에 하드코딩되어 추상화 경계가 느슨하다. 확장성 측면에서 현재 구조는 AI 전략 다양화나 멀티-게임 세션 확장 시 Gateway 수정이 불가피한 구조이므로, AI 상태와 턴 처리 책임을 `GameService`로 이전하는 리팩토링이 권장된다.

### 위험도

**MEDIUM**