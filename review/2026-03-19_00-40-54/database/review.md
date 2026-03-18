### 발견사항

---

**[WARNING] `gameParticipant.playerUuid` 단일 컬럼 인덱스 누락**
- 위치: `game-participant.entity.ts` — `@Unique(['gameId', 'playerUuid'])`
- 상세: 복합 유니크 인덱스의 선두 컬럼이 `gameId`이므로 `playerUuid`만으로 필터링하는 쿼리 (`getPlayerHistory`, `getRankings`)는 이 인덱스를 활용하지 못합니다.
- 제안:
  ```ts
  @Index()
  @Column({ type: 'text' })
  playerUuid: string;
  ```

---

**[WARNING] `game.roomId`, `room.status`, `game.status` 인덱스 누락**
- 위치: `game.entity.ts`, `room.entity.ts`
- 상세:
  - `deleteByRoom`은 `WHERE roomId = ?`로 `game`을 조회하나 `roomId`에 인덱스가 없습니다.
  - `getWaitingRooms`는 `WHERE status = 'waiting'` 사용하나 `room.status`에 인덱스 없습니다.
  - `onModuleInit`의 `update({ status: 'in-progress' }, ...)` 도 `game.status` 풀스캔입니다.
- 제안:
  ```ts
  // game.entity.ts
  @Index()
  @Column({ type: 'text' })
  roomId: string;

  @Index()
  @Column({ type: 'text', default: 'in-progress' })
  status: GameStatus;

  // room.entity.ts
  @Index()
  @Column({ type: 'text', default: 'waiting' })
  status: RoomStatus;
  ```

---

**[WARNING] `leaveRoom` 다중 DB 작업이 단일 트랜잭션 밖에서 실행됨**
- 위치: `room.service.ts` — `leaveRoom` 메서드
- 상세: `roomPlayerRepository.remove` → `gameService.deleteByRoom` → `roomRepository.remove` 순서로 각각 별도 트랜잭션. `deleteByRoom` 실패 시 RoomPlayer는 삭제됐지만 Room이 남는 불일치 상태가 발생할 수 있습니다.
- 제안: 세 작업을 단일 `queryRunner` 트랜잭션으로 묶거나, 적어도 `GameParticipant → Game → Room → RoomPlayer` 삭제를 CASCADE로 DB에 위임.

---

**[WARNING] `deleteByRoom`에서 트랜잭션 외부의 `find` 호출 (TOCTOU)**
- 위치: `game.service.ts` — `deleteByRoom`
- 상세: `gameRepository.find`로 gameIds를 읽은 뒤 트랜잭션을 시작하는 구조. find와 delete 사이에 새 게임이 삽입되면 누락됩니다.
- 제안: `find`를 queryRunner 트랜잭션 내부로 이동.

---

**[INFO] `getPlayerHistory` 페이지네이션 없음**
- 위치: `hall-of-fame.service.ts` — `getPlayerHistory`
- 상세: 플레이어의 모든 게임 이력을 제한 없이 로드합니다. 게임 수가 많아지면 메모리 및 응답 지연 문제가 발생합니다.
- 제안: `page`, `limit` 파라미터를 추가하고 `.take()` / `.skip()` 적용.

---

**[INFO] `getWaitingRooms`에 상한 없음**
- 위치: `room.service.ts` — `getWaitingRooms`
- 상세: 대기 중인 방을 전부 반환합니다. 서비스 성장 시 부담이 될 수 있습니다.
- 제안: `.take(50)` 등 상한 추가 또는 페이지네이션 도입.

---

**[INFO] Room settings를 JSON 문자열로 저장**
- 위치: `room.entity.ts` — `settings: string`
- 상세: `RoomSettings` 구조가 변경될 때 기존 JSON과의 호환성을 코드에서 직접 관리해야 합니다. DB 마이그레이션으로 관리되지 않아 형식 불일치 위험이 있습니다.
- 제안: 구조가 변경될 때 기본값 처리 로직을 `getSettings()`에 포함하거나, `smallBlind`/`bigBlind`/`startingChips`를 별도 컬럼으로 분리하는 것을 고려.

---

### 요약

비즈니스 로직과 무관한 순수 게임 엔진 파일들은 DB와 관계없습니다. DB 관련 코드를 살펴보면, TypeORM QueryBuilder를 통한 파라미터화 쿼리 사용과 `queryRunner` 기반의 트랜잭션 패턴 자체는 잘 구현되어 있습니다. 그러나 `playerUuid`, `game.roomId`, `room.status`, `game.status` 등 자주 조회되는 컬럼에 인덱스가 누락되어 있어 데이터가 쌓일수록 성능이 저하될 우려가 있습니다. 또한 `leaveRoom`의 다중 DB 작업이 단일 트랜잭션으로 보호되지 않아 실패 시 데이터 불일치가 발생할 수 있으며, `getPlayerHistory`와 `getWaitingRooms`의 무제한 조회는 미래의 스케일 문제를 예고합니다.

### 위험도
**MEDIUM**