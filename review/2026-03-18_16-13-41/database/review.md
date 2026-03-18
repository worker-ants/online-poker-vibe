### 발견사항

**[CRITICAL] `synchronize: true` 프로덕션 사용 위험**
- 위치: `backend/src/database/database.module.ts:11`
- 상세: TypeORM의 `synchronize: true`는 애플리케이션 시작 시 자동으로 스키마를 변경합니다. 프로덕션 환경에서는 컬럼 삭제/타입 변경 시 데이터 손실이 발생할 수 있습니다.
- 제안: 환경 변수로 제어하거나 마이그레이션 파일을 사용하세요.
```typescript
synchronize: process.env.NODE_ENV !== 'production',
```

---

**[CRITICAL] N+1 쿼리 - `getPlayerHistory`**
- 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts:130~155`
- 상세: `participations` 배열을 순회하며 각 게임마다 `participantRepository.find()`를 호출합니다. 게임 수가 N개이면 N+1번의 쿼리가 발생합니다.
- 제안: `IN` 조건으로 한 번에 조회하거나 JOIN으로 처리하세요.
```typescript
const gameIds = participations.map(p => p.game.id);
const allParticipants = await this.participantRepository.find({
  where: { gameId: In(gameIds) },
  relations: ['player'],
});
// gameId로 그룹핑 후 사용
```

---

**[WARNING] 트랜잭션 미사용 - 방 생성**
- 위치: `backend/src/room/room.service.ts:54~76`
- 상세: `room` 저장 후 `roomPlayer` 저장 사이에 실패하면 방만 생성되고 호스트가 입장하지 않은 불완전한 상태가 됩니다.
- 제안: 트랜잭션으로 묶으세요.
```typescript
await this.roomRepository.manager.transaction(async (em) => {
  await em.save(room);
  await em.save(roomPlayer);
});
```

---

**[WARNING] 트랜잭션 미사용 - 게임 종료 처리**
- 위치: `backend/src/game/game.service.ts:210~245`
- 상세: `gameRepository.update()` 후 `participantRepository.save()`를 반복 호출합니다. 중간에 실패하면 게임 상태는 `completed`이지만 일부 참가자 기록만 저장된 불일치 상태가 됩니다.
- 제안: `finishGame` 전체를 단일 트랜잭션으로 처리하세요.

---

**[WARNING] 인덱스 누락 - 자주 조회되는 컬럼들**
- 위치: 엔티티 파일들
- 상세: 다음 컬럼들에 인덱스가 없어 쿼리 성능 저하가 예상됩니다.
  - `room_player.playerUuid` — `findPlayerCurrentRoom()`에서 매번 조회
  - `room.status` — `getWaitingRooms()`에서 `WHERE status = 'waiting'`
  - `game_participant.gameId` — `getGameResult()`에서 조회
  - `game.status` — 랭킹 집계 쿼리의 필터 조건
- 제안:
```typescript
@Index()
@Column({ type: 'text' })
playerUuid: string;
```

---

**[WARNING] 페이지네이션 카운트 쿼리 비효율**
- 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts:54~65`
- 상세: 전체 카운트를 위한 쿼리와 데이터 조회 쿼리가 분리되어 있어 2번의 DB 호출이 발생합니다. SQLite에서 큰 문제는 아니지만 카운트 쿼리가 집계 조건과 완벽히 일치하지 않을 위험이 있습니다.
- 제안: TypeORM의 `getManyAndCount()`를 활용하거나 동일 조건을 공유하는 서브쿼리로 처리하세요.

---

**[WARNING] `settings` 컬럼의 JSON 문자열 저장**
- 위치: `backend/src/room/room.entity.ts:36`
- 상세: `settings: string`으로 JSON을 직렬화해 저장합니다. SQLite는 `simple-json` 타입을 지원하며, TypeORM도 `type: 'simple-json'`을 지원합니다. 현재 방식은 타입 안전성이 없고 실수로 raw string을 저장할 수 있습니다.
- 제안:
```typescript
@Column({ type: 'simple-json' })
settings: RoomSettings;
```

---

**[INFO] SQLite 파일 경로의 `__dirname` 사용**
- 위치: `backend/src/database/database.module.ts:9`
- 상세: 컴파일된 JS 파일 기준으로 경로가 결정됩니다. 빌드 구조 변경 시 DB 파일 위치가 달라질 수 있습니다.
- 제안: 환경 변수로 경로를 주입받는 것이 더 안전합니다.
```typescript
database: process.env.DB_PATH ?? join(process.cwd(), 'data', 'poker.sqlite'),
```

---

**[INFO] 랭킹 정렬 기준의 1게임 플레이어 우대 문제**
- 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts:84~88`
- 상세: `winRate` 기준 정렬 시 1게임만 이기고 100% 승률인 플레이어가 항상 상위에 오릅니다.
- 제안: 최소 게임 수 필터(`HAVING COUNT(*) >= 5`) 또는 베이지안 평균을 적용하세요.

---

### 요약

데이터베이스 관점에서 가장 심각한 문제는 `synchronize: true`의 무조건적 사용과 방 생성 및 게임 종료 시 트랜잭션 부재입니다. 이 두 가지는 데이터 정합성에 직접적인 위협이 됩니다. 또한 `getPlayerHistory()`의 N+1 쿼리 패턴과 자주 조회되는 컬럼(`playerUuid`, `status` 등)의 인덱스 누락은 사용자가 늘어날수록 성능 병목이 될 것입니다. SQLite를 사용하는 현재 단계에서는 체감 성능이 낮겠지만, 프로덕션 데이터베이스로 마이그레이션 전에 반드시 해결해야 할 구조적 문제들입니다.

### 위험도

**HIGH**