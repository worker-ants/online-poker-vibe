## 동시성 코드 리뷰

### 발견사항

---

**[CRITICAL]** `GameService.handleAction` — async 경계에서의 게임 상태 경쟁 조건
- 위치: `backend/src/game/game.service.ts`, `handleAction()`
- 상세: `await this.finishGame(active, alivePlayers)` 호출 시 Node.js 이벤트 루프에 제어권이 반환된다. 이 await 구간 동안 동일 room의 다른 WebSocket 이벤트(예: `startNextHand` 호출, 또 다른 플레이어 액션)가 처리될 수 있다. `finishGame` 내부에서 `activeGames.delete(active.roomId)`가 호출되기 전에 `startNextHand(roomId)`가 실행되면 종료 처리 중인 게임에 새 핸드가 시작되거나, `finishGame`이 이미 삭제된 게임의 상태를 계속 수정하는 문제가 발생한다.
- 제안: 핸드 종료 처리를 시작하기 전에 `activeGames`에서 게임을 먼저 제거하거나, 처리 중 상태 플래그(예: `isFinishing: boolean`)를 도입해 중복 진입을 차단할 것

```typescript
// 개선 예시
if (active.engine.isHandComplete(active.state)) {
  // 먼저 activeGames에서 제거하여 중복 처리 방지
  this.activeGames.delete(roomId);
  const result = active.engine.resolveHand(active.state);
  // ...
  await this.finishGame(active, alivePlayers);
}
```

---

**[CRITICAL]** `RoomService.joinRoom` — TOCTOU 경쟁 조건으로 인한 좌석 중복 배정
- 위치: `backend/src/room/room.service.ts`, `joinRoom()` (인원 확인 → 좌석 배정 구간)
- 상세: 두 플레이어가 동시에 입장 시 둘 다 `room.roomPlayers.length >= room.maxPlayers` 체크를 통과한 뒤, 동일한 `seatIndex`를 배정받아 DB 저장을 시도한다. `@Unique(['roomId', 'seatIndex'])` 제약이 있어 두 번째 저장은 실패하지만, NestJS에서 TypeORM 제약 위반 에러(`QueryFailedError`)는 `BadRequestException`이 아닌 500 Internal Server Error로 클라이언트에 노출된다.
- 제안: `QueryFailedError`를 잡아 적절한 에러 메시지로 변환하거나, DB 레벨의 트랜잭션 + 비관적 락(pessimistic write lock)으로 체크와 삽입을 원자적으로 처리할 것

---

**[WARNING]** `PlayerService.setNickname` — 닉네임 중복 체크의 TOCTOU
- 위치: `backend/src/player/player.service.ts`, `setNickname()`
- 상세: `findOne({ where: { nickname } })` 이후 `save()` 사이에 다른 요청이 동일 닉네임을 먼저 저장하면, 의도한 `BadRequestException('이미 사용 중인 닉네임입니다.')` 대신 DB 유니크 제약 위반 에러(500)가 발생한다.
- 제안: `save()` 호출을 try-catch로 감싸 `QueryFailedError`를 `BadRequestException`으로 변환할 것

---

**[WARNING]** `RoomService.toggleReady` — Read-Modify-Write 경쟁 조건
- 위치: `backend/src/room/room.service.ts`, `toggleReady()`
- 상세: 동일 플레이어가 빠르게 두 번 요청을 보내면, 두 요청 모두 같은 `isReady` 값을 읽고 동일 값으로 저장한다. 결과적으로 토글이 한 번만 적용된 것처럼 동작한다 (false → true → true, 예상은 false → true → false).
- 제안: TypeORM의 `update()` 메서드를 사용하여 DB 레벨에서 원자적으로 값을 반전시키거나, 클라이언트에서 toggle 대신 명시적인 ready/unready 상태를 전송하도록 변경할 것

---

**[WARNING]** `PlayerService.findOrCreate` — 동시 생성 시 PK 충돌 무처리
- 위치: `backend/src/player/player.service.ts`, `findOrCreate()`
- 상세: 동일 UUID로 두 요청이 동시에 도착하면 둘 다 `findByUuid` 결과 null을 받고 `save()`를 시도한다. PK 제약(`PrimaryColumn uuid`)으로 두 번째는 실패하지만 에러가 전파된다.
- 제안: `save()` 실패 시 재시도 또는 `upsert`/`findOne or save` 패턴으로 교체할 것

---

**[WARNING]** `GameService.getPrivateStates` — 내부 상태 직접 참조 반환
- 위치: `backend/src/game/game.service.ts`, `getPrivateStates()`
- 상세: `result[player.uuid] = player.holeCards`는 내부 `GameState`의 `holeCards` 배열에 대한 직접 참조를 반환한다. 호출자가 이 배열을 변경하면 실제 게임 상태가 오염된다.
- 제안: `player.holeCards.slice()` 또는 `[...player.holeCards]`로 복사본을 반환할 것

---

### 요약

이 포커 애플리케이션의 핵심 동시성 위험은 **Node.js의 싱글 스레드 + async/await 조합**에서 발생한다. Node.js는 싱글 스레드이므로 순수 동기 코드에서는 경쟁 조건이 없으나, `await` 지점에서 이벤트 루프에 제어권이 반환되어 동일 자원에 대한 복수 요청이 동시 처리될 수 있다. 특히 `GameService.activeGames`는 애플리케이션 수명 동안 공유되는 뮤터블 Map으로, `handleAction`의 async 경계에서 핸드 종료 처리 도중 다른 WebSocket 이벤트가 끼어드는 CRITICAL 수준의 경쟁 조건이 존재한다. DB 레벨에서는 유니크 제약이 안전망 역할을 하고 있으나, 제약 위반 에러를 적절히 처리하는 코드가 없어 사용자 경험에 영향을 준다. `toggleReady`의 read-modify-write 패턴도 실제 게임 환경에서 문제가 될 수 있다. 전반적으로 단일 서버 인스턴스 기준으로는 대부분 DB 제약으로 데이터 무결성은 유지되나, 에러 처리 미흡과 핸드 종료 로직의 async 경쟁 조건을 우선 수정해야 한다.

### 위험도
**HIGH**