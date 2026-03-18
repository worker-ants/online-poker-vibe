## 발견사항

### [WARNING] `IGameMode` 인터페이스 - 메서드 계약 문서 없음
- **위치**: `game-mode.interface.ts` 전체
- **상세**: `getSmallBlind(handNumber: number)`, `getBigBlind(handNumber: number)` 등 모든 메서드에 JSDoc이 없습니다. `handNumber` 파라미터가 1-indexed인지 0-indexed인지, tournament/cash 간 동작 차이가 어떻게 되는지 알 수 없습니다.
- **제안**:
  ```ts
  /**
   * Returns the small blind amount for the given hand.
   * @param handNumber - 1-indexed hand number within the game session.
   *   In cash games, this is ignored and a fixed value is returned.
   *   In tournaments, this determines the blind level.
   */
  getSmallBlind(handNumber: number): number;
  ```

---

### [WARNING] `IPokerEngine` 인터페이스 - 엔진 라이프사이클 문서 없음
- **위치**: `poker-engine.interface.ts` 전체
- **상세**: `initialize → startHand → handleAction → resolveHand` 의 순서 의존성이 문서화되어 있지 않습니다. `resolveHand`를 `isHandComplete` 확인 없이 호출하면 어떻게 되는지도 불명확합니다.
- **제안**:
  ```ts
  /**
   * Poker engine interface defining the game loop contract.
   *
   * Lifecycle:
   *   1. initialize() — create initial GameState from seats
   *   2. startHand()  — deal cards and post blinds
   *   3. handleAction() / getValidActions() — betting loop
   *   4. isHandComplete() — check for end condition
   *   5. resolveHand() — distribute pot; MUST only be called when isHandComplete() is true
   */
  export interface IPokerEngine { ... }
  ```

---

### [WARNING] `GameService.handleAction` — `fromAiLoop` 파라미터 미문서화
- **위치**: `game.service.ts:73`
- **상세**: `fromAiLoop = false` 파라미터가 외부 호출자가 AI 플레이어 액션을 스푸핑하는 것을 방지하는 보안 제어 플래그임에도 불구하고 JSDoc이 없습니다. 이 파라미터의 목적을 모르는 기여자가 우회하거나 잘못 사용할 위험이 있습니다.
- **제안**:
  ```ts
  /**
   * @param fromAiLoop - Must be true when called from the AI loop.
   *   Prevents external clients from injecting actions on behalf of AI players.
   *   External callers should always use the default (false).
   */
  async handleAction(..., fromAiLoop = false): Promise<HandleActionResult>
  ```

---

### [WARNING] `HallOfFameService.getRankings` — 복잡한 Raw SQL 쿼리 미설명
- **위치**: `hall-of-fame.service.ts:44-85`
- **상세**: 정렬 기준이 `winRate DESC → wins DESC → totalGames DESC → lastGameTime DESC` 순서이지만 왜 이 우선순위를 선택했는지 설명이 없습니다. 동률(tie-breaking) 정책이 비즈니스 요구사항인데 인라인 주석이 없습니다.
- **제안**:
  ```ts
  // Ranking order: win rate first, then total wins (to favor more active players
  // over lucky single-game winners), then recency for equal stats.
  .orderBy('winRate', 'DESC')
  ```

---

### [WARNING] `eslint-disable` 주석이 인터페이스 설계 문제를 은폐
- **위치**: `cash-game.mode.ts:20,24,28`, `tournament.mode.ts:26`
- **상세**: `_handNumber` 파라미터가 사용되지 않는다는 `eslint-disable` 주석이 3곳이나 반복됩니다. 이는 `IGameMode` 인터페이스 문서에 "cash game ignores handNumber" 라고 명시하면 해결되는 사항입니다. 주석이 문제를 해결하는 것이 아니라 숨기고 있습니다.
- **제안**: `IGameMode` JSDoc에 각 메서드별 구현 계약 차이를 명시하고, `eslint-disable` 대신 `/** @inheritdoc - handNumber ignored in cash games */` 형태의 문서로 대체.

---

### [WARNING] `GameService` 공개 API — JSDoc 전무
- **위치**: `game.service.ts` 전체 공개 메서드
- **상세**: `getPublicState`, `getPrivateStates`, `getActionRequired`, `startNextHand`, `deleteByRoom` 등 외부에서 호출되는 메서드들에 JSDoc이 없습니다. 특히 `getPublicState`가 `deck` 필드를 제거하고 `holeCards` 대신 `cardCount`를 반환한다는 보안 변환이 문서화되지 않았습니다.
- **제안**:
  ```ts
  /**
   * Returns sanitized game state safe to broadcast to all clients.
   * Strips: deck, holeCards (replaced with cardCount to prevent cheating).
   * Returns null if no active game exists for the room.
   */
  getPublicState(roomId: string): PublicGameState | null
  ```

---

### [WARNING] 환경변수 문서화 부재
- **위치**: `main.ts:10,15`
- **상세**: `FRONTEND_URL`과 `PORT` 환경변수가 사용되지만 `.env.example`이나 README에 문서화 여부를 확인해야 합니다. 새로운 기여자가 설정 방법을 알 수 없습니다.
- **제안**: README 또는 `.env.example`에 `FRONTEND_URL=http://localhost:3001 # Frontend URL for CORS`, `PORT=3000 # Backend port` 추가.

---

### [INFO] `PokerEngineFactory` — 팩토리 메서드 미문서화
- **위치**: `poker-engine.factory.ts:13,22`
- **상세**: `createMode`의 `settings.blindSchedule ?? [...]` 부분에서 기본 블라인드 스케줄이 하드코딩되어 있는데, 이 값들의 출처나 설계 근거가 없습니다.
- **제안**: 기본 블라인드 스케줄에 `// Default tournament blind schedule: doubles roughly every 10 hands` 주석 추가.

---

### [INFO] `five-card-draw.engine.ts` — `// simplified:` 주석이 불완전
- **위치**: `five-card-draw.engine.ts:202`
- **상세**: `// (simplified: just shuffle the discarded cards back)` 주석은 이것이 올바른 구현이 아님을 암시하지만, 알려진 제약사항 또는 TODO로 명확히 표시되지 않았습니다.
- **제안**:
  ```ts
  // TODO: Properly track all discarded cards from all players across the draw phase.
  // Currently only reshuffles the current player's discards, which may cause
  // duplicate cards if multiple players draw with a small deck.
  ```

---

### [INFO] `HandEvaluator.compareHands` — 반환값 부호 방향 미명시
- **위치**: `hand-evaluator.ts:34`
- **상세**: 기존 주석 `// Compare two hands. Returns positive if a > b...`는 좋으나, `sort()` 콜백과의 관계 (오름차순/내림차순)가 명시되지 않아 정렬 방향 혼동 위험이 있습니다.
- **제안**: `// Use with Array.sort() for ascending order: .sort((a,b) => compareHands(a,b))` 추가.

---

## 요약

전반적으로 코드 품질은 높지만 문서화는 일관성이 부족합니다. `HandEvaluator`, `PotCalculator`처럼 일부 클래스는 JSDoc이 잘 작성되어 있는 반면, `IGameMode`, `IPokerEngine` 같은 핵심 인터페이스와 `GameService`의 공개 API는 JSDoc이 전혀 없습니다. 특히 엔진 라이프사이클(`initialize → startHand → handleAction → resolveHand`), `fromAiLoop` 보안 플래그, `getPublicState`의 보안 변환 로직은 다음 기여자가 반드시 이해해야 할 내용임에도 문서화되지 않아 유지보수 리스크가 있습니다. `eslint-disable` 주석이 인터페이스 설계 문제를 3곳에서 반복적으로 은폐하는 패턴도 개선이 필요합니다.

## 위험도

**LOW** — 현재 코드 동작에는 영향 없으나, 팀 규모 확장이나 새 기여자 합류 시 온보딩 비용 및 오용 위험이 증가합니다.