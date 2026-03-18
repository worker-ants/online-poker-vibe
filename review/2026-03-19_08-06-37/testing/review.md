## 발견사항

### [WARNING] `deleteByRoom` 트랜잭션 롤백 경로 테스트 누락
- **위치**: `game.service.spec.ts` - `deleteByRoom` describe 블록
- **상세**: `queryRunner.manager.remove` 또는 `createQueryBuilder().execute()`가 예외를 던질 때 `rollbackTransaction`과 `release`가 호출되는지 검증하는 테스트가 없음. 서비스 코드의 try/catch/finally 블록은 중요한 에러 복구 경로이나 완전히 미커버
- **제안**:
  ```typescript
  it('should rollback and release on error', async () => {
    const inProgressGame = { id: 'game-1', status: 'in-progress' };
    mockGameRepository.find.mockResolvedValue([inProgressGame]);
    mockQueryRunnerForDelete.manager.remove.mockRejectedValue(new Error('DB error'));
    mockGameRepository.manager.connection.createQueryRunner.mockReturnValue(mockQueryRunnerForDelete);

    await expect(service.deleteByRoom('room-1')).rejects.toThrow('DB error');
    expect(mockQueryRunnerForDelete.rollbackTransaction).toHaveBeenCalled();
    expect(mockQueryRunnerForDelete.release).toHaveBeenCalled();
  });
  ```

---

### [WARNING] `deleteByRoom` 이후 인메모리 `activeGames` 정리 테스트 및 구현 누락
- **위치**: `game.service.ts:376` (`deleteByRoom` 메서드), `game.service.spec.ts`
- **상세**: `deleteByRoom`은 DB 레코드만 삭제하고 `this.activeGames`에서 해당 룸의 게임을 제거하지 않음. 룸 삭제 후에도 인메모리 게임이 잔존할 수 있고, 이후 `getPublicState`, `handleAction` 등에서 고아 상태 접근 가능. 테스트도 이 시나리오를 검증하지 않음
- **제안**: `deleteByRoom` 구현에 `this.activeGames.delete(roomId)` 추가, 테스트에서 `isGameActive(roomId)`가 false가 되는지 검증

---

### [WARNING] 트랜잭션 생명주기 검증 부재
- **위치**: `game.service.spec.ts` - `deleteByRoom` - 첫 번째 테스트
- **상세**: `connect`, `startTransaction`, `commitTransaction`, `release` 호출 여부를 검증하지 않음. 트랜잭션이 올바르게 시작되고 커밋되며 정리되는지 보장되지 않음
- **제안**:
  ```typescript
  expect(mockQueryRunnerForDelete.connect).toHaveBeenCalled();
  expect(mockQueryRunnerForDelete.startTransaction).toHaveBeenCalled();
  expect(mockQueryRunnerForDelete.commitTransaction).toHaveBeenCalled();
  expect(mockQueryRunnerForDelete.release).toHaveBeenCalled();
  ```

---

### [WARNING] `GameParticipant` 삭제 대상 엔티티 검증 누락
- **위치**: `game.service.spec.ts:286` - `deleteByRoom` 첫 번째 테스트
- **상세**: `mockDeleteQueryBuilder.delete`가 호출된 것만 확인하고, `.from(GameParticipant)`로 올바른 엔티티를 대상으로 했는지 검증하지 않음. 다른 엔티티를 삭제해도 테스트 통과
- **제안**:
  ```typescript
  expect(mockDeleteQueryBuilder.from).toHaveBeenCalledWith(GameParticipant);
  expect(mockDeleteQueryBuilder.where).toHaveBeenCalledWith(
    'gameId IN (:...gameIds)',
    { gameIds: ['game-1'] }
  );
  ```

---

### [WARNING] `roomId` nullable 변경에 대한 쿼리 동작 테스트 미존재
- **위치**: `game.entity.ts`, `game.service.spec.ts`
- **상세**: `roomId`가 `nullable: true`로 변경되어 `onDelete: 'SET NULL'` 시 게임 레코드가 `roomId = null`로 남음. `deleteByRoom`이 `{ roomId, status: 'in-progress' }` 조건으로 검색 시 `roomId`가 실제로 null인 레코드를 올바르게 제외하는지, null roomId를 가진 게임이 `onModuleInit`에서 `abandoned`로 정상 처리되는지 검증하는 테스트 없음
- **제안**: `deleteByRoom` 호출 후 `roomId: null` 인 게임 레코드가 보존되는 시나리오 테스트 추가

---

### [INFO] 비null 단언(`!`) 사용으로 테스트 의도 모호
- **위치**: `game.service.spec.ts:162, 207, 227, 229, 233, 270`
- **상세**: TypeScript 컴파일 오류를 `!`로 우회하는 것은 null인 경우 런타임 에러로 이어질 수 있고 테스트 의도가 불명확해짐. `null`이 아님을 명시적으로 검증하는 것이 더 명확함
- **제안**:
  ```typescript
  const actionRequired = service.getActionRequired('room-1');
  expect(actionRequired).not.toBeNull(); // 명시적 null 검증
  const result = await service.handleAction('room-1', actionRequired!.playerUuid, ...);
  ```

---

### [INFO] 두 번째 `deleteByRoom` 테스트의 검증 보완 필요
- **위치**: `game.service.spec.ts:301-312`
- **상세**: `mockQueryRunnerForDelete.manager.createQueryBuilder`가 호출되지 않은 것만 검증. `mockGameRepository.manager.connection.createQueryRunner` 자체가 호출되지 않는지 검증하면 early return 동작을 더 명확히 표현 가능
- **제안**:
  ```typescript
  expect(mockGameRepository.manager.connection.createQueryRunner).not.toHaveBeenCalled();
  ```

---

## 요약

이번 변경의 핵심인 `deleteByRoom` 기능 추가에서 Happy Path 테스트는 적절히 작성되었으나, **트랜잭션 롤백 경로, 인메모리 상태 정리, 트랜잭션 생명주기 검증**이 모두 누락되어 있습니다. 특히 `deleteByRoom` 이후 `activeGames`에 고아 상태가 남는 잠재적 버그는 테스트 미비와 구현 누락이 동시에 존재하는 상황입니다. `roomId` nullable 변경은 데이터 무결성 측면에서 중요한 스키마 변경이지만, 이에 대한 경계값 테스트가 없습니다. `useGameStore.spec.ts`의 타입 동기화 수정은 적절합니다.

## 위험도

**MEDIUM**