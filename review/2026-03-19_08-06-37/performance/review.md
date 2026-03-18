## 성능 코드 리뷰

### 발견사항

---

#### **[WARNING]** N+1 쿼리 — `finishGame` 내 루프에서 개별 `save` 호출

- **위치**: `game.service.ts` — `finishGame` 메서드
- **상세**:
  ```typescript
  for (const { player, overallPlacement } of humanPlayers) {
    const participant = this.participantRepository.create({ ... });
    await queryRunner.manager.save(participant); // 플레이어 수만큼 개별 INSERT
  }
  ```
  플레이어 수(최대 6명)만큼 별도 INSERT 쿼리가 발생합니다. 현재 규모에서는 큰 문제가 아니지만, 루프 내 `await DB call` 패턴은 불필요한 왕복 비용을 유발합니다.
- **제안**: 엔티티 배열을 먼저 생성 후 `queryRunner.manager.save(participants)`로 단일 배치 INSERT 처리.
  ```typescript
  const participants = humanPlayers.map(({ player, overallPlacement }) => {
    const result = this.resolvePlayerResult(player, topChips, topCount);
    return this.participantRepository.create({ ... });
  });
  await queryRunner.manager.save(participants);
  ```

---

#### **[WARNING]** 루프 내 불변값 반복 호출 — `getStartingChips()`

- **위치**: `game.service.ts` — `finishGame` 메서드
- **상세**:
  ```typescript
  for (const { player, overallPlacement } of humanPlayers) {
    const startingChips = active.mode.getStartingChips(); // 매 반복마다 호출
    ...
  }
  ```
  `getStartingChips()`는 게임 내에서 불변값이므로 루프 내에서 반복 호출할 이유가 없습니다. 구현에 따라 내부적으로 계산 비용이 발생할 수 있습니다.
- **제안**: 루프 바깥으로 호이스팅.
  ```typescript
  const startingChips = active.mode.getStartingChips();
  for (const { player, overallPlacement } of humanPlayers) { ... }
  ```

---

#### **[WARNING]** `remove(games)` 배열 전달 시 개별 DELETE 가능성

- **위치**: `game.service.ts` — `deleteByRoom` 메서드
- **상세**:
  ```typescript
  await queryRunner.manager.remove(games);
  ```
  TypeORM의 `remove(entities[])` 구현에 따라 내부적으로 엔티티마다 개별 `DELETE` 쿼리를 발행할 수 있습니다. 방 삭제 시 진행 중인 게임이 1개를 초과할 경우 비효율적입니다.
- **제안**: 이미 `gameIds` 배열이 있으므로 `GameParticipant` 삭제와 동일한 방식으로 단일 `DELETE ... WHERE id IN (...)` 쿼리 사용.
  ```typescript
  await queryRunner.manager
    .createQueryBuilder()
    .delete()
    .from(Game)
    .where('id IN (:...gameIds)', { gameIds })
    .execute();
  ```

---

#### **[INFO]** `deleteByRoom` — 트랜잭션 외부의 사전 조회

- **위치**: `game.service.ts` — `deleteByRoom` 메서드
- **상세**:
  ```typescript
  const games = await this.gameRepository.find({ where: { roomId, status: 'in-progress' } });
  if (games.length === 0) return;
  // 이후 별도 트랜잭션 시작...
  ```
  `find`와 이후 DELETE 사이에 경쟁 조건(race condition)이 이론적으로 존재합니다. 실제로 동시 삭제 요청이 드문 상황이므로 심각하진 않으나, 조회를 트랜잭션 내부로 이동하거나 전체를 단일 쿼리로 합치면 더 안전합니다.
- **제안**: `find`를 트랜잭션 내부로 이동하거나, 서브쿼리를 사용하여 조회와 삭제를 단일 쿼리로 처리.

---

#### **[INFO]** `getPublicState` — 매 호출 시 객체 배열 재생성

- **위치**: `game.service.ts` — `getPublicState` 메서드
- **상세**:
  ```typescript
  players: state.players.map((p) => ({ uuid: p.uuid, nickname: p.nickname, ... }))
  ```
  게임 이벤트 브로드캐스트마다 호출되므로, 플레이어 수 × 브로드캐스트 빈도만큼 객체가 생성됩니다. 최대 6명 규모에서는 GC 부담이 미미하나, 초당 수십 회 이상 호출되는 구조라면 인지 필요합니다.
- **제안**: 현재 규모에서는 조치 불필요. 향후 방 수가 크게 늘면 변경된 필드가 있을 때만 재계산하는 메모이제이션 고려.

---

### 요약

이번 변경의 핵심인 `deleteByRoom` 필터링(`in-progress`만 삭제)과 `roomId` nullable 전환은 성능 측면에서 적절합니다. 단, `finishGame` 내에서 루프마다 개별 `save` 호출과 `getStartingChips()` 반복 호출이 발견되었으며, 특히 배치 INSERT로의 개선이 코드 품질과 성능 양면에서 권장됩니다. `deleteByRoom`의 `remove(games)` 역시 단일 DELETE 쿼리로 대체하면 더 명확하고 효율적입니다. 전반적으로 최대 6명 규모의 게임에서 즉각적인 성능 문제가 발생할 수준은 아니지만, N+1 패턴은 설계 원칙상 개선하는 것이 바람직합니다.

### 위험도

**LOW**