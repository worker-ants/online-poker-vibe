### 발견사항

---

**[CRITICAL] `resolveHand` 로직이 세 엔진에 거의 동일하게 중복**
- 위치: `texas-holdem.engine.ts`, `five-card-draw.engine.ts`, `seven-card-stud.engine.ts` — `resolveHand()` 메서드
- 상세: 팟 계산 → 적합자 필터 → 핸드 비교 → 분배 → 폴백 처리까지 100줄에 가까운 로직이 세 파일에 거의 동일하게 존재. 버그 수정이나 규칙 변경 시 세 곳 모두 수정해야 함
- 제안: `BasePokerEngine` 추상 클래스를 만들어 `resolveHand`, `findNextActive`, `createInitialPlayerState` 등 공통 메서드를 상속

---

**[CRITICAL] fourth-street 카드 딜 로직 버그성 중복 코드**
- 위치: `seven-card-stud.engine.ts:197-201`
```ts
if (!player.isFolded && !player.isAllIn) {
    player.visibleCards.push(deckCards.splice(0, 1)[0]);
} else if (!player.isFolded) {
    player.visibleCards.push(deckCards.splice(0, 1)[0]);
}
```
- 상세: `isAllIn` 여부와 무관하게 동일한 코드가 실행되므로 두 분기가 `if (!player.isFolded)`와 동일. 이후 street(fifth~seventh)는 단순하게 작성되어 있어 일관성도 없음
- 제안: `if (!player.isFolded)` 단일 조건으로 통합

---

**[WARNING] `findNextActive` / `findNextActivePlayerIndex` 이름 불일치**
- 위치: `texas-holdem.engine.ts:220` vs `five-card-draw.engine.ts:224`
- 상세: 동일한 역할의 private 메서드가 파일마다 다른 이름을 사용. 코드 추적 시 혼란 유발
- 제안: 이름을 통일하고, 공통 베이스 클래스로 추출

---

**[WARNING] 매직 넘버 / 매직 상수 다수 존재**
- 위치: 여러 파일
- 상세:
  - `game.service.ts:206` — `timeLimit: 30` (숫자 의미 불명확)
  - `seven-card-stud.engine.ts:82` — `Math.max(1, Math.floor(newState.minRaise / 5))` (5 = 안테 비율)
  - `poker-engine.factory.ts:37-47` — 기본 블라인드 스케줄 값들 (`10, 20, 50, 100, 200, 400`)
  - `hall-of-fame.controller.ts:14-16` — `100`, `20` (페이지 제한)
- 제안: 상수를 이름 있는 const로 추출
```ts
const DEFAULT_ACTION_TIME_LIMIT_SECONDS = 30;
const ANTE_TO_BIG_BLIND_RATIO = 5;
const MAX_PAGE_LIMIT = 100;
```

---

**[WARNING] `eslint-disable` 주석으로 인터페이스 설계 문제를 감추고 있음**
- 위치: `cash-game.mode.ts:18,22,26`, `tournament.mode.ts:21`
- 상세: `IGameMode` 인터페이스의 `getAnte(handNumber)` 파라미터가 `CashGameMode`와 `TournamentMode` 모두에서 사용되지 않아 eslint-disable 필요. 인터페이스 설계가 구현체 요구사항을 반영하지 못함
- 제안: `getAnte()`를 선택적 메서드로 변경하거나, 파라미터 없는 별도 메서드로 분리

---

**[WARNING] `getWaitingRooms`의 `any[]` 반환 타입**
- 위치: `room.service.ts:113`
- 상세: `async getWaitingRooms(): Promise<any[]>` — 타입 안전성 없이 any 반환. IDE 자동완성 및 타입 체크 불가
- 제안: 반환 타입을 인터페이스 또는 인라인 타입으로 명시

---

**[WARNING] `JSON.parse(JSON.stringify(...))` 딥 클론이 일관되게 사용되나 잠재적 문제**
- 위치: 세 엔진 파일의 `startHand`, `handleAction`, `advancePhase` 등
- 상세: `Date` 객체나 `undefined` 값이 state에 추가될 경우 무음 손실됨. 또한 큰 게임 상태 객체를 매 액션마다 직렬화/역직렬화하는 성능 비용도 있음
- 제안: `structuredClone()` (Node.js 17+)으로 대체하거나, 변경 불변성을 위한 상태 관리 전략을 문서화

---

**[WARNING] `handleDraw`의 간소화된 덱 리셔플 로직에 TODO 주석**
- 위치: `five-card-draw.engine.ts:173-178`
```ts
// If not enough cards in deck, shuffle discards back
// (simplified: just shuffle the discards from other players back into deck)
```
- 상세: 실제 Five-Card Draw 규칙(다른 플레이어의 디스카드를 섞어 재사용)이 구현되지 않음. 주석이 미완성 구현을 인정하고 있음
- 제안: 규칙에 맞게 구현하거나 스펙에 제한사항으로 명시

---

**[WARNING] `getRankings` 메서드가 너무 길고 복잡**
- 위치: `hall-of-fame.service.ts:34-107`
- 상세: 카운트 쿼리, 실제 랭킹 쿼리, 결과 매핑까지 한 메서드에 70줄 이상. 인라인 인터페이스 `RawRankingRow`도 메서드 내부에 정의됨
- 제안: `getTotalPlayerCount()`, `fetchRankingRows()`, `mapRankingRows()` 등으로 분리

---

**[WARNING] `findHighestVisibleHand`가 단순 합산으로 핸드를 평가**
- 위치: `seven-card-stud.engine.ts:252-266`
- 상세: 보이는 카드의 랭크 합으로만 순서를 결정하여 실제 포커 핸드 강도와 다름 (예: A-2-3이 K-K보다 높게 평가될 수 있음)
- 제안: `HandEvaluator`를 사용하거나, 적어도 단순 합산의 한계를 주석으로 명시

---

**[INFO] `isWheel`에 하드코딩된 카드 값**
- 위치: `hand-evaluator.ts:139-144`
- 상세: `[14, 5, 4, 3, 2]` 값이 의미 없이 나열됨
- 제안:
```ts
private isWheel(sortedValues: number[]): boolean {
  const WHEEL = [ACE_VALUE, 5, 4, 3, 2]; // A-2-3-4-5 low straight
  return WHEEL.every((v, i) => sortedValues[i] === v);
}
```

---

**[INFO] `rankName` 메서드가 `RANK_VALUES`와 중복 데이터 보유**
- 위치: `hand-evaluator.ts:196-211`
- 상세: `RANK_VALUES`가 이미 `card.types.ts`에 있는데, `rankName`은 역방향 매핑을 별도 객체로 재정의
- 제안: `card.types.ts`에 `RANK_NAMES: Record<number, string>`을 추가하고 임포트

---

**[INFO] `startHand`가 초기화와 게임 로직을 혼합하여 길어짐**
- 위치: `texas-holdem.engine.ts:57-120` (65줄), `five-card-draw.engine.ts:57-117` (61줄)
- 상세: 딜러 로테이션, 블라인드 포스팅, 카드 딜링이 단일 메서드에 존재
- 제안: `rotateDealerAndBlinds()`, `postBlinds()`, `dealCards()` 등의 private 메서드로 분리

---

### 요약

전반적으로 코드의 가독성과 타입 안전성 수준은 양호하며 NestJS/TypeORM 컨벤션을 잘 따르고 있습니다. 그러나 가장 심각한 유지보수성 문제는 세 포커 엔진 변형(`TexasHoldemEngine`, `FiveCardDrawEngine`, `SevenCardStudEngine`)에서 `resolveHand`를 포함한 핵심 로직이 대규모로 중복되어 있다는 점입니다. 이는 버그 수정이나 규칙 변경 시 여러 파일을 동시에 수정해야 하는 위험을 만들어 낸다는 점에서 우선적으로 해결되어야 합니다. 추가적으로 매직 넘버, `any` 타입 사용, 일부 미완성 구현(`findHighestVisibleHand`, 덱 리셔플)이 장기 유지보수에 부담을 줄 수 있습니다.

### 위험도

**HIGH**