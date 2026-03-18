## 발견사항

### [WARNING] `room.gateway.ts`의 `processAiTurnsOrNotify` 메서드에 대한 단위 테스트 부재
- **위치**: `backend/src/room/room.gateway.ts`
- **상세**: AI 턴 처리의 핵심 로직인 `processAiTurnsOrNotify`는 복잡한 while 루프, 조건 분기, 게임 종료 처리를 포함하지만 테스트가 없음. Gateway는 WebSocket 특성상 테스트 작성이 어렵지만, 해당 메서드가 private이라 직접 테스트가 불가능함.
- **제안**: `processAiTurnsOrNotify`를 별도 서비스로 분리하거나, Gateway 테스트 파일을 만들어 Socket.IO mock으로 핵심 시나리오(AI 연속 턴, 핸드 종료, 게임 종료)를 커버

### [WARNING] `checkAllReady` 변경의 엣지 케이스 테스트 미흡
- **위치**: `backend/src/room/room.service.spec.ts:390-411`
- **상세**: 최소 인원을 2명에서 1명으로 낮추는 변경은 중요한 비즈니스 로직 변경이지만, 추가된 테스트가 기본 케이스만 커버함. "1명 준비, 아직 ready 안 된 경우"나 "여러 명 중 일부만 ready" 케이스는 기존 테스트에서 암묵적으로 커버되나, 새 조건(`< 1`)의 경계값인 0명 케이스는 새로 추가됨 — 이는 좋음.
- **제안**: 현재 구현 양호. 추가적으로 호스트만 있고 ready=false 케이스 테스트 추가 권장

### [WARNING] `getDiscardIndices`의 Full House / Two Pair 케이스 미테스트
- **위치**: `backend/src/ai/ai-player.service.spec.ts`
- **상세**: 페어(2장) 유지, 트립스(3장) 유지는 테스트되나, Two Pair(4장 유지, 1장 버림)와 Quads(4장 유지) 케이스 테스트 누락. 특히 `keepIndices.size > 0` 분기의 Two Pair 처리는 중요한 엣지 케이스.
- **제안**:
```typescript
it('투페어를 유지하고 1장만 버려야 한다', () => {
  const holeCards = [
    { suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'A' },
    { suit: 'clubs', rank: 'K' }, { suit: 'diamonds', rank: 'K' },
    { suit: 'hearts', rank: '3' },
  ];
  const indices = service.getDiscardIndices(holeCards);
  expect(indices).toHaveLength(1);
  expect(indices).toContain(4);
});
```

### [WARNING] 확률적 테스트의 신뢰성 문제
- **위치**: `backend/src/ai/ai-player.service.spec.ts:175-195` (약한 핸드 폴드 테스트)
- **상세**: `foldCount > 70` (100회 중)는 확률적 테스트로 CI에서 간헐적 실패 가능. 블러프 확률(10%)이 존재하므로 이론적으로 100회 중 70회 미만 폴드가 발생할 수 있음.
- **제안**: `jest.spyOn(Math, 'random').mockReturnValue(0.5)` 등으로 난수를 고정하거나, 임계값을 60으로 낮추거나, `toBeGreaterThanOrEqual(60)`으로 여유를 두는 것 권장

### [INFO] `hall-of-fame.service.ts`의 SQL 필터 변경에 대한 테스트 미존재
- **위치**: `backend/src/hall-of-fame/hall-of-fame.service.ts:56, 87`
- **상세**: `NOT LIKE 'ai-%'` 조건 추가는 랭킹 시스템에 중요하지만, `HallOfFameService`에 대한 단위/통합 테스트 파일이 보이지 않음. AI 플레이어 UUID가 랭킹에 포함되지 않는 것을 검증하는 테스트 필요.
- **제안**: HallOfFame 서비스 spec 파일 생성 또는 기존 파일에 AI 필터링 테스트 추가

### [INFO] `game.service.ts`의 `getGameResult` 리팩토링에 대한 테스트 부재
- **위치**: `backend/src/game/game.service.ts:319-371`
- **상세**: DB 조회 방식에서 인메모리 상태 기반으로 완전히 변경되었으나, `GameService`의 해당 로직을 검증하는 테스트가 없음. 특히 Draw 판정 로직(동일 칩 보유자 수 계산)이 정확한지 확인 불가.
- **제안**: `GameService` 단위 테스트 추가 또는 기존 테스트에서 `getGameResult` 시나리오 커버

### [INFO] `ai-player.service.spec.ts` 내 `evaluateHandStrength` 경계값 하드코딩
- **위치**: `backend/src/ai/ai-player.service.spec.ts:100`
- **상세**: `expect(score).toBe(0.1)` — 하이카드 점수를 정확히 0.1로 고정 검증. 구현 내부의 scoreMap 값과 강하게 결합되어 있어, scoreMap 조정 시 테스트가 깨짐.
- **제안**: `expect(score).toBeLessThan(0.3)`처럼 범위로 검증하는 것이 더 유연함

---

## 요약

전반적으로 `AiPlayerService`의 핵심 로직(핸드 강도 평가, 디스카드 결정, 액션 결정)은 다양한 시나리오를 커버하는 양질의 테스트가 작성되어 있으며, `RoomService`의 `checkAllReady` 변경도 테스트가 적절히 업데이트되었다. 그러나 **가장 복잡한 통합 포인트인 `RoomGateway.processAiTurnsOrNotify`에 테스트가 없다는 점**이 가장 큰 리스크이며, 확률적 테스트의 CI 안정성 문제와 `HallOfFameService`의 AI 필터링 검증 부재도 보완이 필요하다. 특히 AI 연속 턴 처리 중 게임 종료 시나리오는 버그 발생 가능성이 높아 별도 테스트 추가를 강력히 권장한다.

## 위험도

**MEDIUM**