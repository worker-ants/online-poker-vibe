### 발견사항

- **[WARNING]** `activeGames` / `finishingRooms` — 인스턴스 메모리 상태로 인한 수평 확장 불가
  - 위치: `game.service.ts:39-40` (`private activeGames`, `private finishingRooms`)
  - 상세: 게임 상태 전체가 단일 서버 프로세스의 메모리에 저장됩니다. 서버 재시작 시 모든 진행 중인 게임 상태가 소멸하며, 로드밸런서를 통한 다중 인스턴스 배포 시 인스턴스 간 상태가 공유되지 않아 같은 방의 두 플레이어가 서로 다른 인스턴스에 연결될 경우 게임 진행이 불가합니다.
  - 제안: Redis 등 외부 스토어로 게임 상태를 이관하거나, 최소한 sticky session을 보장하는 배포 정책과 서버 종료 시 상태 영속화 로직을 추가하세요.

- **[WARNING]** `finishingRooms` 가드의 check-then-act 패턴
  - 위치: `game.service.ts:handleAction` — `finishingRooms.has()` 체크(상단)와 `finishingRooms.add()`(게임오버 분기) 사이의 간격
  - 상세: Node.js 단일 스레드 모델에서는 두 `await` 사이의 동기 코드가 원자적으로 실행되므로 현재 구현은 안전합니다. 그러나 `has()` 체크와 `add()` 호출 사이에 상당량의 동기 로직(`resolveHand`, 칩 분배)이 존재해 코드 구조 변경 시 경쟁 조건이 발생할 수 있습니다. 또한 게임오버가 아닌 정상 핸드 완료(`handComplete: true, gameOver: false`) 경로에서는 `finishingRooms` 보호가 없어 WebSocket 게이트웨이가 `startNextHand`를 호출하는 타이밍에 의존합니다.
  - 제안: 핸드 완료 여부를 추적하는 별도 플래그를 `ActiveGame`에 추가하고, 상태 전이를 명시적으로 관리하세요.

- **[WARNING]** 엔진 클래스의 `Deck` 인스턴스 필드 공유
  - 위치: `texas-holdem.engine.ts:22`, `five-card-draw.engine.ts:22`, `seven-card-stud.engine.ts:24` (`private deck = new Deck()`)
  - 상세: `Deck`이 엔진 인스턴스의 필드로 선언되어 있습니다. 현재는 각 방마다 별도 엔진 인스턴스가 생성(`PokerEngineFactory.createEngine`)되고 `startHand` 내 `deck.reset()` / `deck.shuffle()` / `deck.getCards()`가 모두 동기적으로 실행되므로 실제 경쟁 조건은 발생하지 않습니다. 그러나 상태(덱)가 엔진 인스턴스에 묶여 있어 `GameState`의 순수 불변 전달이 깨집니다 — `newState.deck = this.deck.getCards()` 이후 동일 엔진으로 `startHand`를 재호출하면 이전 `deck` 참조가 무효화될 위험이 있습니다.
  - 제안: `Deck`을 `startHand` 내 로컬 변수로 생성하거나, 덱 셔플 결과를 `GameState`에만 저장하도록 리팩토링하세요.

- **[INFO]** `getPublicState` — 칩 분배 후 DB 커밋 전 상태 노출
  - 위치: `game.service.ts:handleAction` — 칩 분배(`player.chips += winner.amount`) 이후 `await this.finishGame(active)` 진입 시점
  - 상세: 게임오버 경로에서 칩이 메모리 상태에 먼저 반영된 뒤 DB 트랜잭션이 실행됩니다. `await` 중 게이트웨이가 `getPublicState`를 호출하면 DB에는 아직 기록되지 않은 최종 칩 수가 클라이언트에 전송됩니다. DB 롤백 발생 시 클라이언트와 서버 상태가 불일치합니다.
  - 제안: 칩 분배를 `finishGame` 완료 이후로 이동하거나, 게임오버 상태를 명시적으로 표시하고 DB 커밋 완료 후 최종 상태를 브로드캐스트하도록 순서를 조정하세요.

- **[INFO]** `deleteByRoom`의 TOCTOU (Time-of-Check-to-Time-of-Use)
  - 위치: `game.service.ts:deleteByRoom` — `find()` await 이후 삭제 트랜잭션 시작 전
  - 상세: `gameRepository.find()`로 조회한 뒤 트랜잭션 실행 전 구간에 새 게임이 생성될 수 있습니다. 현재 아키텍처에서는 방이 비어야만 삭제되므로 발생 가능성이 낮지만, DB 레벨 제약이 없는 구조적 취약점입니다.
  - 제안: `WHERE roomId = ?` 조건을 트랜잭션 내에서 직접 실행하는 단일 DELETE 쿼리로 대체하세요.

---

### 요약

이 코드베이스는 Node.js 단일 스레드 이벤트 루프를 적절히 활용하고 있어 실제 메모리 경쟁 조건은 발생하지 않습니다. `handleAction` 내 상태 변이와 `finishingRooms` 가드는 동기 구간 내에서 처리되어 현재 환경에서는 안전합니다. 그러나 **가장 심각한 위험은 인스턴스 메모리 의존**으로, 서버 장애나 수평 확장 시 진행 중인 모든 게임 상태가 소멸합니다. 추가로 엔진 클래스의 `Deck` 인스턴스 필드, 게임오버 경로의 칩 분배와 DB 커밋 간 순서 문제가 보완이 필요한 설계 취약점입니다.

### 위험도

**MEDIUM**