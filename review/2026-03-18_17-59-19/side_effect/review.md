## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] `processAiTurnsOrNotify`의 무한 루프 가능성**
- 위치: `room.gateway.ts` - `processAiTurnsOrNotify()` 메서드
- 상세: `while (true)` 루프 안에서 `getActionRequired()`가 null을 반환하면 `break`하지만, AI 액션 처리 중 예외가 발생하면 catch 없이 루프가 중단됩니다. 더 심각한 것은 게임 엔진이 AI 플레이어의 액션을 처리한 후 다시 같은 AI 플레이어에게 턴을 부여하는 버그가 있을 경우 무한 루프가 될 수 있습니다. `handComplete`가 `true`인 경우 `break`하지만, `gameOver`가 아니고 `setTimeout`으로 `startNextHand`를 호출한 후에도 루프가 계속 실행되는 구조입니다.
- 제안: 루프 실행 횟수에 상한을 두거나 (`maxIterations`), try-catch로 예외를 처리하세요.

---

**[WARNING] `aiPlayersMap`의 메모리 누수 가능성**
- 위치: `room.gateway.ts` - `aiPlayersMap` 인스턴스 변수
- 상세: `aiPlayersMap`은 게임 종료 시(`GAME_ENDED` 이벤트)와 `gameOver` 시에만 `delete`됩니다. 그러나 연결 오류, 서버 재시작 없이 방이 `abandoned` 상태로 종료되거나, 플레이어가 모두 연결을 끊는 경우에는 `aiPlayersMap`에서 항목이 삭제되지 않아 메모리 누수가 발생합니다.
- 제안: `handleDisconnect` 또는 방 정리 로직에서 `aiPlayersMap.delete(roomId)`를 호출하세요.

---

**[WARNING] `startGame` 시그니처 변경으로 인한 호출자 영향**
- 위치: `game.service.ts:47` - `startGame(room: Room, aiPlayers: PlayerSeat[] = [])`
- 상세: `aiPlayers` 파라미터가 기본값을 가지므로 기존 호출자는 영향을 받지 않습니다. 단, `room.gateway.ts`의 `startGame()` 메서드에서 `aiPlayersMap.get(roomId) ?? []`로 AI 플레이어를 주입하는데, 만약 `aiPlayersMap`에 해당 roomId가 없으면 빈 배열이 전달되어 AI 없이 게임이 시작됩니다. 이는 `checkAllReady` → `aiPlayersMap.set` → `startGame` 순서가 동일 이벤트 핸들러 내에서 보장되므로 정상이지만, 만약 순서가 바뀌면 무음 실패(silent failure)가 발생합니다.
- 제안: `startGame` 호출 시 `aiPlayersMap`이 설정되었는지 확인하는 방어 로직 추가를 고려하세요.

---

**[WARNING] `hall-of-fame.service.ts`의 타입 안전성 변화**
- 위치: `hall-of-fame.service.ts:140` - `const game = participation.game;`
- 상세: 기존 `participation.game!`을 `participation.game`으로 변경했습니다. `validParticipations`는 이미 `p.game`이 truthy인 것들만 필터링했으므로 실제 위험은 없지만, `game.id`를 바로 사용하는 다음 줄에서 TypeScript는 `game`이 `undefined`일 수 있다는 경고를 표시할 수 있습니다.
- 제안: `if (!game) continue;` 가드를 추가하거나, 필터 타입을 좁혀 TypeScript에 `game`이 non-null임을 알리세요.

---

**[INFO] `getGameResult`가 DB 대신 인메모리 상태를 참조**
- 위치: `game.service.ts` - `getGameResult()` 메서드
- 상세: 기존에는 DB에서 `GameParticipant`를 조회했지만 이제는 인메모리 `active.state.players`를 사용합니다. `finishGame()`이 완료된 직후 `getGameResult()`를 호출하는데, `finishGame()` 내에서 `this.activeGames.delete(active.roomId)`를 수행한 후 `getGameResult(active)`를 호출합니다. `active` 객체는 이미 로컬 변수로 참조 중이므로 삭제 후에도 접근 가능하지만, 이 의존성이 명확하지 않습니다.
- 제안: 코드 순서가 `finishGame` → `getGameResult` 순임을 주석으로 명시하거나, `getGameResult`가 `activeGames` 맵이 아닌 직접 `active` 객체를 받아서 처리하도록 유지하세요 (현재 구조는 이미 그렇게 되어있어 정상).

---

**[INFO] `checkAllReady` 조건 완화로 인한 단독 플레이어 즉시 시작**
- 위치: `room.service.ts:276` - `room.roomPlayers.length < 1`
- 상세: 최소 인원이 2명에서 1명으로 변경되어 플레이어 1명만 준비해도 게임이 시작됩니다. 이는 의도된 변경이지만, 방을 만들면서 동시에 준비 상태로 전환한 경우 즉시 게임이 시작될 수 있다는 사용자 경험 변화가 있습니다. 방장이 방을 만들자마자 준비 버튼을 누르면 혼자 게임이 시작될 수 있습니다.
- 제안: 의도된 동작이라면 UI에서 명확히 안내하세요.

---

**[INFO] `isAiPlayer` 함수의 UUID 접두어 불일치 가능성**
- 위치: `ai-names.ts`의 `AI_UUID_PREFIX = 'ai-player-'` vs `hall-of-fame.service.ts`의 `"gp.playerUuid NOT LIKE 'ai-%'"`
- 상세: `AI_UUID_PREFIX`는 `'ai-player-'`이지만, 랭킹 필터는 `'ai-%'`를 사용합니다. 현재는 `ai-player-`가 `ai-`로 시작하므로 필터가 작동하지만, 향후 AI UUID 형식이 변경되거나 `ai-`로 시작하는 일반 플레이어가 생기면 오탐이 발생할 수 있습니다. 반대로 `isAiPlayer()` 함수를 사용하지 않고 raw SQL을 쓰는 점도 일관성 문제입니다.
- 제안: 필터 조건을 `AI_UUID_PREFIX`와 동기화하거나 상수로 관리하세요: `NOT LIKE 'ai-player-%'`.

---

### 요약

이번 변경의 핵심은 AI 플레이어 통합으로, 전반적으로 부작용이 잘 통제되어 있습니다. 가장 주목할 위험은 `processAiTurnsOrNotify`의 `while (true)` 루프로, 게임 엔진 버그 발생 시 이벤트 루프를 블로킹할 수 있습니다. `aiPlayersMap`의 누수 가능성과 `hall-of-fame` 필터의 UUID 접두어 불일치는 잠재적 유지보수 부채입니다. `startGame` 시그니처 변경은 기본값 덕분에 하위 호환성이 유지됩니다. `getGameResult`의 DB → 인메모리 전환은 AI 플레이어 포함을 위한 의도된 변경으로 적절하며, `finishGame` 후 `active` 객체가 여전히 유효한 상태에서 호출되므로 논리적 문제는 없습니다.

### 위험도

**MEDIUM**