### 발견사항

- **[WARNING]** `leaveRoom`의 TOCTOU 경쟁 조건 (Race Condition)
  - 위치: `room.service.ts` — `leaveRoom` 메서드
  - 상세: `roomPlayerRepository.remove(roomPlayer)` 실행 후, `roomRepository.findOne(relations: ['roomPlayers'])` 호출 사이에 Node.js 이벤트 루프의 await 양보 지점이 있음. 두 플레이어가 동시에 방을 나갈 경우(예: WebSocket disconnect 이벤트 동시 수신), 두 호출 모두 `room.roomPlayers.length === 0` 조건을 만족하여 게임 레코드 및 방 삭제 로직이 중복 실행될 수 있음. 두 번째 삭제 시도는 이미 삭제된 레코드를 대상으로 하여 에러 또는 조용한 실패를 유발함.
  - 제안: `leaveRoom` 전체 로직을 트랜잭션으로 묶거나, DB 수준의 UNIQUE 제약 + `INSERT OR IGNORE` 패턴을 사용하거나, 방 삭제 전 SELECT FOR UPDATE(또는 낙관적 락)를 적용할 것.

- **[CRITICAL]** 멀티스텝 삭제의 트랜잭션 부재 (Atomicity)
  - 위치: `room.service.ts` — `leaveRoom` 내 게임 레코드 삭제 블록
  - 상세: 아래 세 단계가 트랜잭션 없이 순차 실행됨.
    ```
    1. participantRepository.createQueryBuilder().delete()...execute()
    2. gameRepository.remove(games)
    3. roomRepository.remove(room)
    ```
    1단계와 2단계 사이에 서버 오류나 프로세스 재시작이 발생하면 `GameParticipant`는 삭제되었지만 `Game`과 `Room`은 남아 고아(orphan) 데이터가 생성됨. `createRoom`은 `queryRunner`로 트랜잭션을 사용하고 있으나 `leaveRoom`의 삭제 로직에는 동일한 보호가 없음.
  - 제안: `roomRepository.manager.connection.createQueryRunner()`를 사용하여 삭제 로직 전체를 단일 트랜잭션으로 처리할 것. 혹은 엔티티에 `onDelete: 'CASCADE'`가 이미 추가되었으므로, 수동 삭제를 제거하고 `roomRepository.remove(room)` 단일 호출만으로 cascade 삭제를 DB에 위임하는 방안이 더 단순하고 안전함.

- **[WARNING]** 호스트 이전(host transfer)의 경쟁 조건
  - 위치: `room.service.ts` — `leaveRoom` 하단 host 이전 로직
  - 상세: 호스트와 다른 플레이어가 동시에 방을 떠날 경우, 두 호출 모두 `room.hostUuid === playerUuid` 조건을 평가할 수 있음. `roomPlayers` 스냅샷이 각 호출 시점에 다를 수 있어 `nextHost` 선택 결과가 불일치하거나, 이미 퇴장한 플레이어가 호스트로 지정될 수 있음.
  - 제안: 호스트 이전 로직도 동일 트랜잭션 내에서 처리하거나, 낙관적 락(버전 컬럼)을 사용하여 동시 수정 충돌을 감지할 것.

- **[INFO]** CASCADE 설정과 수동 삭제 로직의 중복
  - 위치: `game-participant.entity.ts`, `game.entity.ts`, `room.service.ts`
  - 상세: 엔티티에 `onDelete: 'CASCADE'`가 추가되었지만, `leaveRoom`에서 수동으로 `GameParticipant` → `Game` 순서로 삭제하고 있음. DB 마이그레이션이 적용되면 `Room` 삭제만으로 CASCADE가 동작하므로 수동 삭제 코드가 중복이 됨. 반대로 마이그레이션이 아직 미적용 상태라면 CASCADE가 동작하지 않아 수동 삭제에만 의존하게 되어 일관성이 불분명함.
  - 제안: 마이그레이션 적용 여부를 명확히 하고, 적용 후에는 수동 삭제 블록을 제거하여 단일 진실 공급원(single source of truth)을 유지할 것.

---

### 요약

핵심 동시성 위험은 `leaveRoom` 메서드에 집중되어 있다. Node.js의 단일 스레드 이벤트 루프에서도 `await` 지점마다 다른 이벤트가 끼어들 수 있어, 동시 퇴장 시 TOCTOU 경쟁 조건이 현실적으로 발생할 수 있다. 특히 멀티스텝 삭제 로직(`GameParticipant` → `Game` → `Room`)에 트랜잭션이 없어, 중간 실패 시 데이터 불일치가 발생할 수 있는 것이 가장 심각한 문제다. 또한 `onDelete: 'CASCADE'` 선언과 수동 삭제 코드의 공존은 마이그레이션 상태에 따라 동작이 달라지는 불명확한 상황을 만든다. 프론트엔드의 카드 색상 변경과 히스토리 문서 변경은 동시성과 무관하다.

### 위험도

**HIGH**