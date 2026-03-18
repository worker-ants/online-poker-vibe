### 발견사항

**[WARNING] `leaveRoom` 테스트가 participant 삭제를 검증하지 않음**
- 위치: `room.service.spec.ts` - "should delete room and game records when last player leaves" 테스트
- 상세: `mockGameRepository.remove`는 검증하지만, `mockParticipantRepository.createQueryBuilder().delete().execute()`는 검증하지 않음. participant 삭제 로직이 실제로 호출되는지 테스트되지 않음
- 제안:
  ```typescript
  const mockQb = mockParticipantRepository.createQueryBuilder();
  expect(mockQb.delete).toHaveBeenCalled();
  expect(mockQb.where).toHaveBeenCalledWith('gameId IN (:...gameIds)', { gameIds: ['game-1'] });
  expect(mockQb.execute).toHaveBeenCalled();
  ```

**[WARNING] `mockParticipantRepository`의 QueryBuilder mock이 매 호출마다 새 객체를 반환하지 않음**
- 위치: `room.service.spec.ts` - `mockParticipantRepository` 정의 (line 43-51)
- 상세: `createQueryBuilder`가 매번 새 mock 객체를 반환하는 것처럼 보이지만, 실제로는 호출할 때마다 동일한 내부 객체를 반환하지 않을 수 있음. `jest.fn(() => ({ ... }))` 패턴은 매 호출마다 새 객체를 반환하므로, 반환된 객체에 대한 assertion이 어려움
- 제안:
  ```typescript
  const mockQueryBuilder = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(() => Promise.resolve()),
  };
  const mockParticipantRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };
  ```

**[WARNING] games가 없을 때의 분기 테스트 누락**
- 위치: `room.service.spec.ts`
- 상세: `room.service.ts`의 `leaveRoom`에는 `games.length > 0`인 경우만 participant/game 삭제를 수행하는 분기가 있음. 마지막 플레이어가 떠날 때 게임 기록이 없는 경우(예: 게임 시작 전 방 폭파)에 대한 테스트 케이스가 없음
- 제안:
  ```typescript
  it('should delete room even when no game records exist', async () => {
    // ... setup
    mockGameRepository.find.mockResolvedValue([]);
    await service.leaveRoom('room-1', 'p1');
    expect(mockGameRepository.remove).not.toHaveBeenCalled();
    expect(mockRoomRepository.remove).toHaveBeenCalled();
  });
  ```

**[WARNING] `onDelete: 'CASCADE'` 변경에 대한 통합 테스트 부재**
- 위치: `game.entity.ts`, `game-participant.entity.ts`
- 상세: DB 레벨의 CASCADE 동작은 unit test의 mock으로 검증 불가. 실제 SQLite DB를 사용하는 통합 테스트가 없으면 CASCADE가 실제로 작동하는지 보장할 수 없음. Room 삭제 시 Game → GameParticipant의 연쇄 삭제도 동일
- 제안: TypeORM의 `@nestjs/typeorm`과 SQLite in-memory를 사용하는 통합 테스트 추가 검토

**[INFO] Card 컴포넌트의 색상 변경에 대한 시각적 테스트 없음**
- 위치: `frontend/src/components/cards/Card.tsx`
- 상세: `text-white` → `text-gray-900` 변경은 접근성(대비) 개선을 위한 것으로 보이나, 이에 대한 스냅샷 테스트나 렌더링 테스트가 존재하지 않음
- 제안: Storybook 스냅샷 또는 jest-dom 기반 렌더링 테스트 추가

**[INFO] `mockGameRepository`와 `mockParticipantRepository`가 `beforeEach`에서 초기화되지 않음**
- 위치: `room.service.spec.ts`
- 상세: `jest.clearAllMocks()`가 `beforeEach`에 있어 mock 함수 자체는 초기화되나, `mockGameRepository.find.mockResolvedValue`처럼 특정 테스트에서 설정된 값이 이후 테스트에 영향을 줄 수 있음. `mockGameRepository.find`는 기본값이 `[]`이나, 이를 명시적으로 리셋하는 것이 더 안전함

---

### 요약

이번 변경에서 핵심 비즈니스 로직인 `leaveRoom` 시 게임 기록 삭제와 CASCADE 설정에 대한 테스트가 추가되었으나, participant 삭제(QueryBuilder 체인)에 대한 검증이 누락되어 있고, `mockParticipantRepository`의 구조상 assertion이 사실상 불가능한 상태임. 또한 게임 기록이 없는 경우의 분기 테스트가 없어 커버리지 갭이 존재하며, DB CASCADE 동작은 단위 테스트로 검증 불가하므로 통합 테스트 보완이 필요함.

### 위험도
**MEDIUM**