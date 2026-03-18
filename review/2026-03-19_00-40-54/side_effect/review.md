## 발견사항

### [WARNING] 엔진 인스턴스의 공유 Deck 변이
- **위치**: `five-card-draw.engine.spec.ts:4`, `seven-card-stud.engine.spec.ts:4`, `texas-holdem.engine.spec.ts:4`
- **상세**: 세 스펙 파일 모두 `const engine = new XxxEngine()`을 `describe` 블록 레벨에서 생성해 모든 테스트가 하나의 엔진 인스턴스를 공유합니다. 각 엔진 내부에 `private deck = new Deck()`이 인스턴스 필드로 존재하며, `startHand()`가 `this.deck.reset()/shuffle()`로 덱을 변이시킵니다. 테스트가 `startHand()` 호출 직후 실패하면 다음 테스트에서 덱 상태가 예측 불가능해질 수 있습니다.
- **제안**: `beforeEach(() => { engine = new XxxEngine(); })` 패턴으로 변경하거나, 최소한 엔진 내부 Deck이 `startHand` 시작 시 항상 완전히 초기화됨을 명확히 보장

---

### [WARNING] seven-card-stud advancePhase의 중복·불완전 분기
- **위치**: `seven-card-stud.engine.ts`, `advancePhase()` `'third-street'` case
- **상세**:
  ```ts
  if (!player.isFolded && !player.isAllIn) {
    player.visibleCards.push(deckCards.splice(0, 1)[0]);
  } else if (!player.isFolded) {  // 올인 플레이어에게도 같은 처리
    player.visibleCards.push(deckCards.splice(0, 1)[0]);
  }
  ```
  두 분기가 동일한 동작을 합니다. 의도가 올인 플레이어에게 다른 처리(예: 카드를 주지 않거나 다르게 처리)를 하려 했다면 실제로는 올인 플레이어도 카드를 받게 되어 의도치 않은 상태 변경이 발생합니다.
- **제안**: `if (!player.isFolded)` 단일 조건으로 통일하거나, 올인 플레이어 처리 의도를 명확히 구분

---

### [WARNING] five-card-draw handleDraw의 덱 재활용 시 부분 카드 오염
- **위치**: `five-card-draw.engine.ts:187-201`, `handleDraw()`
- **상세**: 덱 카드가 부족할 때 현재 플레이어의 `discarded` 카드만 덱에 추가해 셔플한 후 다시 드로우합니다. 이로 인해 플레이어가 방금 버린 카드를 다시 받을 수 있습니다. 또한 다른 플레이어들의 미래 버린 카드는 포함되지 않아 일관성 없는 덱 구성이 발생합니다.
- **제안**: 드로우 단계 시작 시 모든 플레이어의 교체 카드를 확정한 후 버린 카드를 한 번에 재활용하거나, 덱 부족 케이스를 단계 초입에서 처리

---

### [WARNING] game.service.ts의 startGame 중복 호출 시 무음 덮어쓰기
- **위치**: `game.service.ts:83-101`, `startGame()`
- **상세**: 동일 `roomId`로 `startGame()`을 두 번 호출하면 `activeGames.set(room.id, {...})`가 기존 게임 엔트리를 조용히 덮어씁니다. 기존 게임의 DB 레코드는 `in-progress`로 남고 메모리에서만 사라지며, `onModuleInit`에서 서버 재시작 시 `abandoned`로 처리될 때까지 고아 레코드가 됩니다.
- **제안**: `startGame()` 상단에 `if (this.activeGames.has(room.id)) throw new Error(...)` 가드 추가

---

### [WARNING] game.service.ts의 finishingRooms 경쟁 조건
- **위치**: `game.service.ts:108-122`, `handleAction()`
- **상세**: `finishingRooms.has(roomId)` 확인과 `finishingRooms.add(roomId)` 사이에 다른 요청이 진입하면 동시에 `finishGame()`이 두 번 호출될 수 있습니다. Node.js 단일 스레드 이벤트 루프에서는 동기 코드 사이에 다른 요청이 끼어들지 않으므로 이 패턴은 실제로 안전하나, `async/await` 경계를 넘으면 위험합니다. `handleAction` 자체가 `async`이므로 `await this.finishGame()` 호출 전에 다른 요청의 동기 코드가 실행될 수 있습니다.
- **제안**: `finishingRooms.add(roomId)`를 `isHandComplete` 확인 직후, `await` 이전에 이동하여 보호 범위 확대

---

### [INFO] game.service.ts의 chips 직접 변이
- **위치**: `game.service.ts:125-131`, `handleAction()`
- **상세**: 핸드 종료 후 위너의 칩을 `player.chips += winner.amount`로 직접 변이합니다. 엔진의 상태 기계를 우회하여 `activeGames` 맵의 state를 직접 수정하는 방식으로, `getPublicState()`가 즉시 반영합니다. 의도된 설계이나 엔진의 순수 함수 패턴과 일관성이 없습니다.
- **제안**: `resolveHand()`의 반환값을 엔진이 상태에 반영하는 별도 메서드(`applyResult(state, result): GameState`)를 두어 일관성 유지

---

### [INFO] HandEvaluator 공유 인스턴스 (테스트)
- **위치**: `hand-evaluator.spec.ts:5`
- **상세**: `const evaluator = new HandEvaluator()`를 공유하지만 `HandEvaluator`는 완전 무상태(stateless)이므로 실제 문제가 없습니다. 단, 향후 캐싱 등 상태가 추가될 경우 잠재적 위험입니다.

---

## 요약

전반적으로 상태 변경은 `JSON.parse(JSON.stringify(state))`를 통한 깊은 복사로 잘 격리되어 있어 엔진 레이어의 불변성은 양호합니다. 주요 우려사항은 세 곳입니다: ① 테스트에서 공유 엔진 인스턴스의 내부 `Deck` 객체가 변이되어 테스트 간 간섭 가능성, ② `seven-card-stud`의 `advancePhase`에서 올인 플레이어 처리 분기가 중복·불일치하여 의도치 않은 상태 변경 위험, ③ `GameService.startGame()`의 중복 호출 시 기존 게임 엔트리가 조용히 덮어써지는 문제. `finishingRooms`의 경쟁 조건은 Node.js 이벤트 루프 특성상 현재 코드에서는 실질적 위험이 제한적이나 구조적으로 취약합니다.

## 위험도

**MEDIUM**