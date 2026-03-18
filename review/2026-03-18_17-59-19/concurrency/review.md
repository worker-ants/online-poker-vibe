### 발견사항

- **[CRITICAL]** `processAiTurnsOrNotify`의 `while(true)` 루프 내 경쟁 조건
  - 위치: `room.gateway.ts` - `processAiTurnsOrNotify` 메서드
  - 상세: 이 메서드는 `async`이지만 락(lock)이 없습니다. `handleAction` 이벤트 핸들러와 `startNextHand`의 `setTimeout` 콜백, 그리고 `processAiTurnsOrNotify` 루프가 동시에 `gameService.handleAction()`을 호출할 수 있습니다. 예를 들어, AI 턴 루프가 실행 중인 동안 인간 플레이어가 액션을 보내면(또는 `setTimeout`의 `startNextHand`가 트리거되면) `activeGames`의 `state`가 동시에 변이될 수 있습니다.
  - 제안: `finishingRooms`처럼 `processingRooms = new Set<string>()`을 도입하여 `processAiTurnsOrNotify` 진입 시 방어 처리 추가

```typescript
private processingAiTurns = new Set<string>();

private async processAiTurnsOrNotify(roomId: string) {
  if (this.processingAiTurns.has(roomId)) return;
  this.processingAiTurns.add(roomId);
  try {
    while (true) { ... }
  } finally {
    this.processingAiTurns.delete(roomId);
  }
}
```

- **[WARNING]** `GameService.handleAction`의 `finishingRooms` 가드가 AI 루프를 커버하지 못함
  - 위치: `game.service.ts:96` - `handleAction`
  - 상세: `finishingRooms`은 게임 종료 중 중복 처리를 막지만, AI 루프(`processAiTurnsOrNotify`)와 인간 플레이어의 WebSocket 액션이 동시에 `handleAction`을 호출하는 경우를 방어하지 못합니다. Node.js의 단일 스레드 특성 덕분에 실제 동시 실행은 없지만, `await` 경계에서 인터리빙이 발생할 수 있습니다.
  - 제안: `processAiTurnsOrNotify`에서 루프 전체에 걸친 뮤텍스 역할의 Set 가드 추가 (위 제안과 동일)

- **[WARNING]** `startNextHand` 내 `setTimeout` 콜백과 AI 루프의 비동기 인터리빙
  - 위치: `room.gateway.ts` - `processAiTurnsOrNotify` 내 `setTimeout(() => this.startNextHand(roomId), 3000)`
  - 상세: AI 루프에서 핸드가 완료되어 `startNextHand`를 3초 후 예약하는 동안, 외부 이벤트(예: 플레이어 연결 해제 처리)가 게임 상태를 변경할 수 있습니다. `startNextHand`가 실행될 때 `activeGames`에 해당 방이 없을 수 있음 (이미 `try/catch`로 처리되어 있어 치명적이지는 않음).
  - 제안: `setTimeout` 콜백 내에서 방 상태를 재확인하는 것은 현재 `try/catch`로 방어되어 있으나, 명시적인 상태 체크 추가 권장

- **[INFO]** `aiPlayersMap`은 단순 `Map`이나 현재 구조에서는 안전
  - 위치: `room.gateway.ts:45` - `private aiPlayersMap`
  - 상세: Node.js의 단일 스레드 이벤트 루프에서 `Map`은 `await` 경계 사이에서만 읽기/쓰기가 교차될 수 있습니다. `aiPlayersMap`의 설정(`set`)과 읽기(`get`)는 `await` 경계 사이에 있으나, 동일 `roomId`에 대한 중복 게임 시작 이벤트가 오면 `aiPlayersMap`이 덮어써질 수 있습니다.
  - 제안: `startGame` 호출 전 이미 게임이 진행 중인지 체크 (현재 `isGameActive`로 방어 가능)

---

### 요약

Node.js의 단일 스레드 모델 덕분에 멀티스레드 환경의 고전적 경쟁 조건은 발생하지 않지만, `async/await`의 `await` 경계에서 이벤트 루프 인터리빙이 발생할 수 있습니다. 가장 중요한 위험은 `processAiTurnsOrNotify`의 `while(true)` AI 처리 루프인데, 이 루프가 실행되는 동안 외부 WebSocket 이벤트(인간 플레이어 액션, 연결 해제 등)가 `gameService.handleAction`을 동시에 호출하여 게임 상태를 예측 불가능하게 변이시킬 수 있습니다. `finishingRooms` 패턴과 유사하게 `processingAiTurns` 가드를 도입하면 이 문제를 해소할 수 있습니다.

### 위험도
**MEDIUM**