## 요구사항 코드 리뷰 결과

### 발견사항

---

**[WARNING]** `deleteByRoom`에서 인메모리 게임 상태 미정리
- 위치: `game.service.ts` — `deleteByRoom` 메서드
- 상세: DB에서 진행 중인 게임을 삭제하지만, `this.activeGames` 맵에서 해당 roomId 항목을 제거하지 않음. 방이 삭제되어도 게임이 메모리에 남아 `isGameActive`가 `true`를 반환하고, 이후 동일 roomId로 새 게임 시작 시 "이미 진행 중인 게임이 있습니다." 오류 발생 가능
- 제안: `deleteByRoom` 종료 전 `this.activeGames.delete(roomId)` 호출 추가

```typescript
// deleteByRoom 마지막에 추가
this.activeGames.delete(roomId);
```

---

**[WARNING]** `Game` 엔티티의 `room` 관계에 `nullable: true` 누락
- 위치: `game.entity.ts` — `@ManyToOne` 데코레이터
- 상세: `roomId`가 `nullable: true`로 변경되고 `onDelete: 'SET NULL'`이 적용되었으나, 관계 정의에 `nullable: true` 옵션이 없음. TypeORM은 기본적으로 `ManyToOne` 관계를 nullable로 처리하지만, 명시적 선언이 없으면 일부 쿼리 빌더 또는 JOIN 처리에서 의도와 다르게 동작할 수 있음
- 제안: 명시적으로 nullable 표시

```typescript
@ManyToOne(() => Room, { onDelete: 'SET NULL', nullable: true })
```

---

**[WARNING]** `deleteByRoom` 호출 시점과 방 삭제 순서 의존성 검증 누락
- 위치: `game.service.ts` — `deleteByRoom`
- 상세: `onDelete: 'SET NULL'`이 설정된 상태에서, 만약 Room 레코드가 먼저 삭제되면 연관 Game의 `roomId`가 자동으로 NULL로 변경됨. 이후 `deleteByRoom('room-1')`을 호출하면 `where: { roomId: 'room-1', status: 'in-progress' }` 조건으로 진행 중 게임을 찾을 수 없게 되어 정리가 누락됨. 호출 순서가 코드 외부(room.service.ts)에서 보장되어야 하는데, 이에 대한 검증이 없음
- 제안: `room.service.ts`의 삭제 로직에서 `deleteByRoom` → Room 삭제 순서를 트랜잭션으로 보장하거나, `deleteByRoom` 테스트에 이 시나리오 추가

---

**[WARNING]** `deleteByRoom` 테스트에서 롤백 시나리오 미검증
- 위치: `game.service.spec.ts` — `deleteByRoom` describe 블록
- 상세: 현재 테스트는 정상 경로(in-progress 게임 삭제, 게임 없음)만 검증. `createQueryBuilder().execute()` 또는 `manager.remove()` 실패 시 트랜잭션 롤백 및 에러 전파 여부가 테스트되지 않음
- 제안: 에러 시나리오 테스트 추가

```typescript
it('should rollback transaction on error', async () => {
  const inProgressGame = { id: 'game-1', status: 'in-progress' };
  mockGameRepository.find.mockResolvedValue([inProgressGame]);
  mockQueryRunnerForDelete.manager.remove.mockRejectedValue(new Error('DB error'));
  // ...
  await expect(service.deleteByRoom('room-1')).rejects.toThrow('DB error');
  expect(mockQueryRunnerForDelete.rollbackTransaction).toHaveBeenCalled();
});
```

---

**[INFO]** Hall of Fame 미반영 버그 수정 범위 확인 필요
- 위치: `game.service.ts` — `finishGame`, `game.entity.ts`
- 상세: Turn 16의 요구사항은 "AI와 진행한 게임이 명예의 전당에 기록되지 않는 것"인데, 이번 변경의 핵심은 `deleteByRoom`에서 completed 게임을 보존하고 `roomId`를 nullable로 처리하는 것임. `finishGame` 내부에서 이미 `isAiPlayer` 필터로 AI 플레이어를 `GameParticipant`에서 제외하고 있어 인간 플레이어 기록은 저장됨. 그러나 방이 삭제될 때 `CASCADE`로 게임 자체가 삭제되던 것이 이번 변경으로 `SET NULL`로 수정되어 근본 원인이 해결된 것으로 보임 — 의도와 구현이 일치하나, 이 경로에 대한 E2E 수준 검증은 없음
- 제안: Hall of Fame 조회 시 `roomId IS NULL`인 완료된 게임도 포함되는지 `HallOfFameService` 쿼리 확인 권장

---

### 요약

Turn 16 요구사항(AI 게임의 명예의 전당 미기록 버그)에 대한 근본 원인(Room 삭제 시 CASCADE로 Game 레코드가 함께 삭제되던 문제)이 `onDelete: 'SET NULL'` 변경 및 `deleteByRoom`의 진행 중 게임만 삭제하는 로직으로 올바르게 해결되었다. 그러나 `deleteByRoom`에서 인메모리 `activeGames` 정리가 누락되어 게임 서비스의 상태 일관성이 깨질 수 있는 WARNING 수준 버그가 존재하며, `room` 관계의 `nullable: true` 미명시와 롤백 시나리오 테스트 누락도 보완이 필요하다.

### 위험도

**MEDIUM**