## 발견사항

### [CRITICAL] PotCalculator 테스트 없음
- **위치**: `backend/src/game/engine/pot-calculator.ts`
- **상세**: 사이드팟 계산 로직은 포커 게임의 핵심 금전 로직임에도 불구하고 테스트가 전혀 없음. `partialContributors` 변수는 선언만 되고 사용되지 않으며, 복잡한 올인 시나리오에서 잘못된 결과가 나올 수 있음
- **제안**: 올인 플레이어 포함 3인 이상의 다양한 사이드팟 시나리오 테스트 필수

### [CRITICAL] GameService 테스트 없음
- **위치**: `backend/src/game/game.service.ts`
- **상세**: `handleAction`, `startGame`, `finishGame`, `getPublicState` 등 게임 핵심 비즈니스 로직이 테스트되지 않음. 특히 `finishGame` 내 `result = 'abandoned'` 판정 로직은 `isDisconnected` 체크만으로 1등도 연결 끊기면 `abandoned`가 될 수 있는 버그가 존재함
- **제안**: `@nestjs/testing` + TypeORM in-memory sqlite를 활용한 통합 테스트 작성

### [CRITICAL] RoomService/RoomGateway 테스트 없음
- **위치**: `backend/src/room/room.service.ts`, `room.gateway.ts`
- **상세**: 방 생성, 참여, 강퇴, 준비, 게임 시작 트리거 등 전체 룸 상태 머신이 테스트되지 않음. `leaveRoom` 내 호스트 이전 로직은 `roomPlayers`가 이미 remove된 후 접근하는 잠재적 타이밍 버그 가능성이 있음
- **제안**: 서비스 단위 테스트 및 게이트웨이 이벤트 처리 테스트 작성

### [WARNING] BettingRound 테스트 - 올인 raise 시나리오 누락
- **위치**: `backend/src/game/engine/betting-round.spec.ts`
- **상세**: 올인 금액이 minRaise 미만인 경우 (`raiseBy < newState.minRaise`) 타 플레이어 `hasActed` 리셋이 발생하지 않는 분기가 테스트되지 않음. 또한 모든 플레이어가 올인된 상태에서 `isRoundComplete` 동작 테스트 없음
- **제안**:
```typescript
it('should not reset hasActed when all-in raise is less than minRaise', () => { ... });
it('should be complete when all active players are all-in', () => { ... });
```

### [WARNING] HandEvaluator - 7장에서 5장 스트레이트 플러시 선택 테스트 부재
- **위치**: `backend/src/game/engine/hand-evaluator.spec.ts`
- **상세**: 7장 핸드에서 더 낮은 족보를 제치고 최고의 5장 조합을 선택하는지 검증하는 케이스가 부족함. 특히 스트레이트 플러시 vs 포카드 경쟁 케이스 없음
- **제안**: 7장 중 최선의 조합 선택 검증 테스트 추가

### [WARNING] BettingRound 테스트에서 상태 공유 위험
- **위치**: `backend/src/game/engine/betting-round.spec.ts:8`
- **상세**: `const bettingRound = new BettingRound()`가 `describe` 블록 최상단에 한 번만 생성되어 모든 테스트가 공유함. `BettingRound`가 내부 상태를 가지게 되면 테스트 간 오염이 발생함
- **제안**: `beforeEach`로 이동하여 테스트별 독립 인스턴스 보장

### [WARNING] Deck 셔플 테스트 비결정적 실패 가능성
- **위치**: `backend/src/game/engine/deck.spec.ts:42`
- **상세**: `expect(sameOrder).toBe(false)` 테스트는 Fisher-Yates 셔플이 우연히 동일한 순서를 반환할 확률(1/52! ≈ 0)이 있으나, 더 큰 문제는 PRNG 시드 고정이 없어 CI에서 재현 불가능한 실패가 발생할 수 있음
- **제안**: 셔플 후 통계적으로 분포 검증하거나, 단순히 `remaining()` 카운트 변화 없음을 확인하는 것으로 대체

### [WARNING] FiveCardDraw 엔진 테스트 없음
- **위치**: `backend/src/game/engine/variants/five-card-draw.engine.ts`
- **상세**: 드로우 페이즈(카드 교환 로직)가 포커 변형 중 가장 복잡한 특수 로직이나 테스트가 없음
- **제안**: Texas Hold'em 엔진 테스트 패턴을 참고하여 드로우 액션 처리 테스트 작성

### [WARNING] SevenCardStud 엔진 테스트 없음
- **위치**: `backend/src/game/engine/variants/seven-card-stud.engine.ts`
- **상세**: 브링인(bring-in) 플레이어 결정 로직, 스트리트별 카드 딜링, 7번째 스트리트 페이스다운 딜링 등 테스트 없음

### [WARNING] TournamentMode 블라인드 레벨 계산 테스트 없음
- **위치**: `backend/src/game/engine/modes/tournament.mode.ts`
- **상세**: `getCurrentLevel` 내 레벨 경계값(정확히 마지막 핸드, 스케줄 초과 등) 테스트 없음
- **제안**:
```typescript
it('should stay on last level when hands exceed schedule', () => {
  expect(mode.getSmallBlind(100)).toBe(200); // last level
});
```

### [WARNING] PlayerController 쿠키 설정 로직 중복 - 테스트 필요
- **위치**: `backend/src/player/player.controller.ts:17, 36`
- **상세**: `getMe`와 `setNickname` 모두 uuid 없을 때 새 uuid 생성 및 쿠키 설정 로직이 동일하게 중복. 쿠키 설정 동작 테스트 없음
- **제안**: `@nestjs/testing`으로 컨트롤러 테스트, 특히 신규 쿠키 발급 시나리오 검증

### [INFO] NicknameRequiredGuard 테스트 없음
- **위치**: `backend/src/common/guards/nickname-required.guard.ts`
- **상세**: uuid 없는 경우, 닉네임 없는 경우, 정상 통과 3가지 시나리오 테스트 필요

### [INFO] HallOfFameService 테스트 없음
- **위치**: `backend/src/hall-of-fame/hall-of-fame.service.ts`
- **상세**: 복잡한 SQL 집계 쿼리 (`getRankings`)는 실제 DB 동작과 다를 수 있어 통합 테스트가 특히 중요

### [INFO] app.controller.spec.ts 삭제 후 대체 테스트 없음
- **위치**: `backend/src/app.controller.spec.ts` (삭제됨)
- **상세**: 기존 AppController 테스트가 삭제되었으나 새로운 앱 레벨 통합 테스트(전체 모듈 로딩 검증 등)로 대체되지 않음

### [INFO] 프론트엔드 테스트 완전 부재
- **위치**: `frontend/app/game/[roomId]/page.tsx`
- **상세**: GamePage 컴포넌트의 소켓 이벤트 핸들러, 조건부 렌더링, 액션 콜백 등 테스트 없음. `useGameStore`, `useSocket` 훅 단위 테스트도 없음

---

## 요약

게임 엔진 핵심 로직(`BettingRound`, `Deck`, `HandEvaluator`, `TexasHoldemEngine`)에는 구조적으로 잘 작성된 단위 테스트가 존재하여 기반은 양호하다. 그러나 **금전 계산의 핵심인 `PotCalculator`**, **전체 게임 흐름을 조율하는 `GameService`**, **룸 상태 머신 `RoomService`/`RoomGateway`** 에 테스트가 전혀 없는 것은 실제 서비스에서 금전적 버그나 게임 상태 불일치를 야기할 수 있는 심각한 리스크다. `FiveCardDraw`, `SevenCardStud` 엔진 변형도 테스트가 없으며, `TournamentMode` 블라인드 레벨 경계값도 검증되지 않았다. 프론트엔드는 테스트가 전무하다.

## 위험도

**HIGH**