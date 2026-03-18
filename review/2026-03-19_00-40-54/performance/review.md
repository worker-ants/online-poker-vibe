### 발견사항

---

**[WARNING] 게임 액션마다 전체 상태를 JSON 직렬화로 깊은 복사**
- 위치: `texas-holdem.engine.ts`, `five-card-draw.engine.ts`, `seven-card-stud.engine.ts` — `handleAction`, `advancePhase`, `handleDraw` 내 `JSON.parse(JSON.stringify(state))`
- 상세: 카드 덱(52장), 플레이어 배열, 라운드 히스토리를 매 액션마다 직렬화/역직렬화함. 텍사스 홀덤 한 핸드에 평균 10~20번의 액션이 발생하며, 각 액션마다 O(state 크기)의 직렬화 비용이 발생함. 특히 `roundHistory`가 누적될수록 비용이 증가함.
- 제안: 불변 패턴 대신 필요한 필드만 선택적으로 복사하거나, 구조적 공유(structural sharing)가 가능한 `structuredClone()`으로 교체. 혹은 상태를 mutation-safe하게 설계하여 복사 자체를 최소화.

```typescript
// 현재: 매 액션마다 전체 상태 직렬화
const newState = JSON.parse(JSON.stringify(state)) as GameState;

// 개선: 필요한 부분만 얕은 복사
const newState = {
  ...state,
  players: state.players.map(p => ({ ...p })),
  deck: [...state.deck],
  roundHistory: [...state.roundHistory],
};
```

---

**[WARNING] `resolveHand` 내 `pots.indexOf(pot)` — 루프 안에서 O(n) 탐색**
- 위치: `texas-holdem.engine.ts:resolveHand`, `five-card-draw.engine.ts:resolveHand`, `seven-card-stud.engine.ts:resolveHand` — 세 파일 모두 동일한 패턴
- 상세: `pots.indexOf(pot)` 호출이 외부 `for (const pot of pots)` 루프 안에 있어 O(n²). 팟 개수가 적어 현재는 무해하지만, 로직이 3곳에 동일하게 복제되어 있어 개선 시 모두 수정해야 함.
- 제안: 인덱스 기반 순회로 변경하거나 `entries()` 사용.

```typescript
// 현재
for (const pot of pots) {
  potType: pots.indexOf(pot) === 0 ? 'main' : 'side'  // O(n) 탐색
}

// 개선
for (const [potIndex, pot] of pots.entries()) {
  potType: potIndex === 0 ? 'main' : 'side'
}
```

---

**[WARNING] `HandEvaluator.rankName()` — 매 호출마다 동일한 객체 생성**
- 위치: `hand-evaluator.ts:rankName`
- 상세: `Record<number, string>` 맵을 함수 호출마다 새로 생성함. `evaluateFive` 내에서 `description` 생성 시 여러 번 호출되며, 7장 핸드 평가 시 21번의 조합 × 복수 호출이 발생함.
- 제안: 클래스 레벨 상수로 추출.

```typescript
private static readonly RANK_NAMES: Record<number, string> = {
  2: 'Two', 3: 'Three', /* ... */ 14: 'Ace',
};

private rankName(value: number): string {
  return HandEvaluator.RANK_NAMES[value] ?? String(value);
}
```

---

**[INFO] `TournamentMode.getSmallBlind`/`getBigBlind` — 동일 입력으로 `getCurrentLevel` 두 번 호출**
- 위치: `tournament.mode.ts:getSmallBlind`, `getBigBlind`
- 상세: 같은 `handNumber`로 `getCurrentLevel`을 독립적으로 두 번 호출. 블라인드 레벨 수가 적어 무해하지만 불필요한 중복임.
- 제안: 두 값을 한 번에 반환하는 내부 메서드 사용 또는 호출부에서 캐싱.

---

**[INFO] `pot-calculator.ts` — `betLevels.includes(maxBet)` Set 변환 후 배열 탐색**
- 위치: `pot-calculator.ts:calculatePots` — `betLevels.includes(maxBet)`
- 상세: `new Set(...)` 으로 중복 제거 후 배열로 변환하고, 다시 `includes()`로 O(n) 탐색. Set을 그대로 유지하면 `O(1)` 탐색 가능.
- 제안:

```typescript
const betLevelSet = new Set(
  allPlayers.filter(p => p.isAllIn && !p.isFolded).map(p => p.currentBet)
);
betLevelSet.add(maxBet); // O(1)
const betLevels = [...betLevelSet].sort((a, b) => a - b);
```

---

**[INFO] `room.service.ts:getWaitingRooms` — 페이지네이션 없는 전체 조회**
- 위치: `room.service.ts:getWaitingRooms`
- 상세: `status: 'waiting'`인 모든 방을 한 번에 불러옴. 방 수가 많아질 경우 메모리와 쿼리 성능에 영향.
- 제안: `take`/`skip` 기반 페이지네이션 추가 고려.

---

**[INFO] `seven-card-stud.engine.ts:findHighestVisibleHand` — 단순 합산으로 패 순서 결정**
- 위치: `seven-card-stud.engine.ts:findHighestVisibleHand`
- 상세: 보이는 카드의 합산값만으로 행동 순서를 결정함. 스터드 규칙상 보이는 패의 강도(페어 > 하이카드 등)로 판단해야 하나, 단순 합산은 정확도가 낮음. 현재는 올바른 값을 빠르게 계산하지만, 정확성을 위해 가벼운 패 평가가 필요할 수 있음.

---

### 요약

전반적으로 포커 도메인의 특성상(최대 9명, 52장 덱) 알고리즘 복잡도는 문제없는 수준이며, 홀오브페임의 N+1 방지(배치 쿼리)도 잘 처리되어 있다. 가장 중요한 성능 이슈는 세 엔진 모두에서 **매 액션마다 전체 게임 상태를 `JSON.parse(JSON.stringify())`로 복사**하는 패턴으로, 실시간 게임에서 반복 호출 시 직렬화 오버헤드가 누적된다. 그 외에는 `rankName` 객체 반복 생성, `pots.indexOf` 중복 탐색, TournamentMode 이중 레벨 탐색 등 소규모 최적화 포인트들이 존재하며, 특히 `resolveHand` 로직이 세 엔진에 동일하게 복제되어 있어 개선 적용 시 유지보수 부담이 세 배가 된다.

### 위험도

**MEDIUM** — JSON 직렬화 기반 상태 복사가 실시간 게임의 응답 지연으로 이어질 수 있으며, 동일 로직의 3중 복제가 향후 최적화를 어렵게 만든다.