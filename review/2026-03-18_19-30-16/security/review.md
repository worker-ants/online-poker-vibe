## 보안 코드 리뷰

### 발견사항

---

**[WARNING] SQL 인젝션 위험 — QueryBuilder의 IN 절 파라미터 바인딩**
- 위치: `room.service.ts` — `leaveRoom()` 내 QueryBuilder
- 상세: `.where('gameId IN (:...gameIds)', { gameIds })` 형식은 TypeORM의 파라미터 바인딩을 사용하고 있어 SQL 인젝션을 방지합니다. 그러나 `gameIds` 배열이 빈 배열일 경우 일부 DB 드라이버에서 `IN ()` 구문 오류가 발생할 수 있으며, 이 경우 예외 처리 부재로 500 에러가 발생할 수 있습니다.
- 제안: QueryBuilder 호출 전에 `gameIds.length > 0` 조건을 명시적으로 확인하거나, 이미 `if (games.length > 0)` 조건이 있으므로 로직이 정상이지만, CASCADE가 설정되었으므로 QueryBuilder 삭제가 중복 실행될 위험이 있습니다.

```typescript
// CASCADE 설정 후에도 수동 삭제를 병행하면 이중 처리가 발생할 수 있음
// onDelete: 'CASCADE'가 DB 레벨에서 자동 처리하므로 수동 삭제 코드는 제거 권장
```

---

**[WARNING] CASCADE 삭제와 수동 삭제의 중복으로 인한 경쟁 조건(Race Condition)**
- 위치: `room.service.ts` `leaveRoom()`, `game-participant.entity.ts`, `game.entity.ts`
- 상세: `GameParticipant`에 `onDelete: 'CASCADE'`를 설정한 동시에 `leaveRoom()`에서 수동으로 `participantRepository`를 통해 DELETE를 실행합니다. DB 레벨 CASCADE가 먼저 실행된 후 수동 삭제가 실행되면 "Entity not found" 에러 또는 중복 삭제 시도가 발생할 수 있습니다.
- 제안: CASCADE를 신뢰하여 수동 삭제 코드를 제거하거나, 트랜잭션으로 감싸 원자성을 보장해야 합니다.

---

**[WARNING] 트랜잭션 부재로 인한 데이터 불일치 가능성**
- 위치: `room.service.ts` `leaveRoom()` (line 180~200 구간)
- 상세: `participantRepository.delete()` → `gameRepository.remove()` → `roomRepository.remove()` 순서로 실행되는데, 중간 단계에서 실패 시 부분 삭제된 데이터가 남아 참조 무결성이 깨집니다. 예를 들어 `gameRepository.remove()` 성공 후 `roomRepository.remove()` 실패 시 고아(orphan) 상태의 Room이 DB에 남습니다.
- 제안: `createQueryRunner()`를 사용하여 트랜잭션으로 묶어야 합니다.

```typescript
const queryRunner = this.roomRepository.manager.connection.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  // 삭제 작업
  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}
```

---

**[INFO] Player CASCADE 삭제의 의도치 않은 데이터 손실 위험**
- 위치: `game-participant.entity.ts` — `@ManyToOne(() => Player, { onDelete: 'CASCADE' })`
- 상세: Player가 삭제될 경우 해당 플레이어의 모든 `GameParticipant` 레코드가 연쇄 삭제됩니다. 명예의 전당 스펙상 게임 전적은 영속적으로 보관되어야 하므로 `SET NULL` 또는 `RESTRICT`가 더 적합할 수 있습니다.
- 제안: Player 삭제 정책이 명확하지 않다면 `onDelete: 'SET NULL'`로 변경하고 `playerUuid` 컬럼을 nullable로 처리하는 것을 검토하세요.

---

**[INFO] 프론트엔드 XSS 위험은 없음 — 색상 변경은 안전**
- 위치: `frontend/src/components/cards/Card.tsx`
- 상세: `text-white` → `text-gray-900` 변경은 단순 CSS 클래스 변경으로 보안 위험 없음. Tailwind CSS 정적 클래스이므로 XSS 가능성 없습니다.

---

**[INFO] 테스트 코드의 mock 격리 적절**
- 위치: `room.service.spec.ts`
- 상세: `beforeEach`에서 `jest.clearAllMocks()`를 호출하여 테스트 간 상태 오염을 방지하고 있습니다. 보안 테스트 관점에서 적절히 격리되어 있습니다.

---

### 요약

이번 변경사항의 핵심은 DB 레벨 CASCADE 설정 추가와 Room 삭제 시 연관 게임 데이터 정리 로직 추가입니다. SQL 인젝션 자체는 TypeORM 파라미터 바인딩으로 방어되어 있으나, **DB 레벨 CASCADE와 애플리케이션 레벨 수동 삭제가 중복 설정**되어 데이터 일관성 문제가 발생할 수 있습니다. 더 중요한 문제는 삭제 로직이 **트랜잭션 없이 순차 실행**되어 중간 실패 시 불일치 데이터가 남을 수 있다는 점입니다. 또한 Player CASCADE 삭제가 게임 전적 영속성 정책과 충돌할 수 있으므로 비즈니스 요구사항 검토가 필요합니다.

---

### 위험도

**MEDIUM**