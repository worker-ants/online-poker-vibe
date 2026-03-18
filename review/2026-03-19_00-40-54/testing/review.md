### 발견사항

- **[CRITICAL]** `TournamentMode`에 테스트 파일 없음
  - 위치: `backend/src/game/engine/modes/tournament.mode.ts`
  - 상세: `getCurrentLevel` 메서드는 블라인드 스케줄을 순회하는 복잡한 로직을 포함하고 있음. 레벨 초과 시 마지막 레벨 반환, `handsPerLevel` 누적 계산 등 버그가 발생하기 쉬운 경계 조건이 모두 미검증 상태.
  - 제안: `tournament.mode.spec.ts` 작성. 첫 번째 레벨, 레벨 전환 경계, 스케줄 초과(마지막 레벨 반환), `getAnte` 등을 테스트.

- **[CRITICAL]** `HallOfFameService`에 테스트 없음
  - 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts`
  - 상세: `getRankings`와 `getPlayerHistory`는 복잡한 SQL 집계 쿼리와 N+1 해결 로직을 포함. 페이지네이션, winRate 계산, AI 플레이어 제외 필터 등 모두 미검증.
  - 제안: `hall-of-fame.service.spec.ts` 작성. mock repository로 집계 결과 검증, AI UUID 필터 동작, 플레이어 없는 경우 등 테스트.

- **[WARNING]** 엔진 spec 파일에서 공유 인스턴스 사용
  - 위치: `five-card-draw.engine.spec.ts:5`, `seven-card-stud.engine.spec.ts:5`, `texas-holdem.engine.spec.ts:5`
  - 상세: `const engine = new *Engine()` 이 `describe` 레벨에 선언되어 모든 테스트가 동일한 인스턴스를 공유함. `FiveCardDrawEngine`의 `this.deck`, `this.bettingRound` 등 상태가 있는 의존성이 테스트 간에 공유되어 순서 의존 버그가 발생할 수 있음.
  - 제안: `beforeEach`에서 `new Engine()`으로 인스턴스를 매번 생성.

- **[WARNING]** `SevenCardStudEngine` 풀 핸드 테스트 없음
  - 위치: `seven-card-stud.engine.spec.ts`
  - 상세: fourth-street까지만 테스트됨. fifth/sixth/seventh-street, 최종 showdown, `resolveHand`는 전혀 테스트되지 않음.
  - 제안: Texas Hold'em spec처럼 모든 스트리트를 통과하는 `should handle a complete hand through showdown` 테스트 추가.

- **[WARNING]** `seven-card-stud.engine.ts`에 중복 코드 — 테스트로 검출 불가
  - 위치: `seven-card-stud.engine.ts` `advancePhase` > `third-street` 분기
  - 상세: `if (!player.isFolded && !player.isAllIn)` 와 `else if (!player.isFolded)` 두 분기가 동일한 코드를 실행함. `isAllIn`인 플레이어는 두 번째 분기에서 처리되므로 첫 번째 분기의 `!player.isAllIn` 조건은 의미 없음. 이 경로를 검증하는 테스트가 없어 로직 오류가 숨어 있음.
  - 제안: all-in 플레이어가 있는 상태에서 가시 카드 개수를 검증하는 테스트 추가.

- **[WARNING]** `GameService` — `mockGameRepository.find`에 반환값 없음
  - 위치: `game.service.spec.ts:43`
  - 상세: `find: jest.fn()` 은 기본적으로 `undefined`를 반환함. `deleteByRoom`에서 `const games = await this.gameRepository.find(...)` 결과가 `undefined`면 `games.length`에서 런타임 에러 발생. `deleteByRoom` 테스트가 없어 이 문제가 잠복함.
  - 제안: `find: jest.fn().mockResolvedValue([])` 로 변경하고 `deleteByRoom` 테스트 추가.

- **[WARNING]** `GameService` — AI 플레이어 액션 가드 미검증
  - 위치: `game.service.spec.ts`, `game.service.ts:89-91`
  - 상세: `handleAction`의 `!fromAiLoop && isAiPlayer(playerUuid)` 가드 로직이 전혀 테스트되지 않음. 보안 관련 코드임에도 테스트 커버리지 없음.
  - 제안: AI UUID로 `handleAction` 호출 시 `'AI 플레이어의 액션을 직접 전송할 수 없습니다.'` 에러를 던지는지 확인하는 테스트 추가.

- **[WARNING]** `PlayerService`에 테스트 파일 없음
  - 위치: `backend/src/player/player.service.ts`
  - 상세: 닉네임 유효성 검사 (`2~20자`, 허용 문자 정규식), SQLITE_CONSTRAINT race condition 처리, `findOrCreate` 멱등성 등 비즈니스 로직이 미검증.
  - 제안: `player.service.spec.ts` 작성. 닉네임 경계값(1자, 21자), 중복 닉네임, SQLITE_CONSTRAINT 처리 등 테스트.

- **[INFO]** `hand-evaluator.spec.ts` — 대부분의 핸드 `values` 배열 미검증
  - 위치: `hand-evaluator.spec.ts`
  - 상세: Straight/Straight Flush의 `values[0]`은 검증하지만, Four of a Kind의 쿼드 값, Two Pair의 페어 순서, One Pair의 키커 순서 등은 검증하지 않음. 이 값들은 `compareHands`에서 직접 사용되어 버그가 발생해도 detect 불가.
  - 제안: 각 핸드 카테고리 테스트에 `values` 배열 검증 추가. 예: `expect(result.values).toEqual([13, 3])` for Four Kings with 3 kicker.

- **[INFO]** `PokerEngineFactory`에 테스트 없음
  - 위치: `backend/src/game/engine/poker-engine.factory.ts`
  - 상세: `createEngine` 지원하지 않는 variant 예외, `createMode` 기본 블라인드 스케줄 설정 등이 미검증.
  - 제안: `poker-engine.factory.spec.ts` 작성.

- **[INFO]** `PotCalculator` — all-in overbet 시나리오 없음
  - 위치: `pot-calculator.spec.ts`
  - 상세: 한 플레이어가 다른 모든 플레이어보다 큰 금액으로 all-in한 경우 (예: p1이 500 all-in, p2/p3이 100 bet) side pot 처리가 테스트되지 않음.
  - 제안: overbet all-in 케이스 추가하여 초과분이 반환 처리되는지 검증.

- **[INFO]** `RoomGateway`에 테스트 없음
  - 위치: `backend/src/room/room.gateway.ts`
  - 상세: WebSocket 이벤트 핸들러(join, leave, ready, action 등), AI 플레이어 루프 트리거, 게임 종료 흐름 등 복잡한 로직이 완전히 미검증.

---

### 요약

핵심 도메인 로직(HandEvaluator, PotCalculator, 각 엔진)은 대체로 양호한 테스트 커버리지를 갖추고 있으나, 몇 가지 중요한 격차가 있다. `TournamentMode`와 `HallOfFameService`처럼 복잡한 로직을 가진 클래스에 테스트가 전혀 없는 것이 가장 큰 위험이며, 엔진 spec의 공유 인스턴스 패턴은 테스트 순서 의존성을 유발할 수 있다. `game.service.spec.ts`는 `deleteByRoom`, AI 가드, `finishingRooms` 동시성 보호 등 주요 경로를 누락하고 있으며, `PlayerService`의 닉네임 유효성 검사 등 사용자 입력 처리 코드도 미검증 상태다.

### 위험도

**HIGH**