### 발견사항

---

**[CRITICAL] `getPlayerHistory`의 N+1 쿼리**
- 위치: `hall-of-fame.service.ts` - `getPlayerHistory()` 메서드
- 상세: `participations` 루프 내에서 각 게임마다 `participantRepository.find()`를 호출. 게임 수가 N이면 N번 추가 쿼리 발생.
- 제안: `gameId IN (...)` 형태로 한 번에 조회하거나, QueryBuilder로 JOIN해서 단일 쿼리로 처리

```typescript
// 현재: N+1 발생
for (const participation of participations) {
  const allParticipants = await this.participantRepository.find({ where: { gameId: game.id }, ... });
}

// 개선: 배치 조회
const gameIds = participations.map(p => p.game.id);
const allParticipants = await this.participantRepository.find({
  where: { gameId: In(gameIds) },
  relations: ['player'],
});
const byGame = groupBy(allParticipants, 'gameId');
```

---

**[WARNING] `BettingRound.cloneState`의 깊은 복사 비용**
- 위치: `betting-round.ts:238` - `cloneState()`, 각 엔진의 `startHand`, `advancePhase`
- 상세: `JSON.parse(JSON.stringify(state))`는 매 액션마다 전체 게임 상태(deck 배열 포함 52장)를 직렬화/역직렬화. 특히 `deck: Card[]`가 최대 52개 객체를 포함해 반복 비용이 큼.
- 제안: `deck`을 `GameState`에서 분리하거나, 구조적 복사(structuredClone)를 사용. 혹은 불변 상태 라이브러리(immer) 도입 검토.

---

**[WARNING] `HandEvaluator.evaluate`의 조합 탐색 비용 (7장)**
- 위치: `hand-evaluator.ts:30-38` - `getCombinations()` 호출
- 상세: 7장에서 5장을 선택하는 경우 C(7,5)=21가지 조합을 생성하고, 각 조합마다 `evaluateFive()`를 호출. 게임 중 모든 플레이어(최대 8명)에 대해 핸드 종료 시 실행되므로 최대 21×8=168번의 평가 수행.
- 상세2: `getCombinations` 내 `result.push([...current])`로 배열을 계속 복사해 GC 압박 발생.
- 제안: 7장 핸드에 대한 Look-up Table(LUT) 기반 평가기 도입. 즉시 적용 가능한 개선으로는 `bestHand` 탐색 시 early-exit 불가하므로 현재 구조 유지 필요하지만, 배열 재사용 패턴 적용 가능.

---

**[WARNING] `getRankings`의 이중 쿼리 (COUNT + 실데이터)**
- 위치: `hall-of-fame.service.ts:56-96`
- 상세: 전체 COUNT를 위한 쿼리와 실제 데이터 쿼리 2회 실행. SQLite에서는 큰 문제가 없으나, 데이터 증가 시 부담.
- 제안: `COUNT(*) OVER()` 윈도우 함수로 단일 쿼리 처리 또는 페이지네이션 정확도가 덜 중요하면 COUNT 쿼리 제거.

---

**[WARNING] `PotCalculator.calculatePots`의 불필요한 정렬 중복**
- 위치: `pot-calculator.ts:10-12`
- 상세: `activePlayers`와 `allPlayers` 두 배열을 별도로 정렬. 또한 `partialContributors`를 계산하지만 사용하지 않음(데드 코드).
- 제안: `partialContributors` 변수 제거. 정렬 공유.

---

**[WARNING] `findHighestVisibleHand`의 단순합 기반 정렬**
- 위치: `seven-card-stud.engine.ts:322-340`
- 상세: 성능 이슈보다는 정확도 문제이지만, 가시 카드의 단순 합으로 "최강 패" 판단 시 매 스트리트마다 호출됨. 실제 핸드 평가기를 써야 하는 경우 O(N) 루프지만 반복 호출 대비 캐싱 없음.
- 제안: 현재 규모(최대 8명)에서는 무시 가능하나, 추후 정확한 핸드 평가로 교체 시 결과 캐싱 고려.

---

**[INFO] `activeGames` Map의 영구 보관**
- 위치: `game.service.ts` - `activeGames: Map<string, ActiveGame>`
- 상세: 게임 종료 시 `finishGame`에서 Map을 정리하지만, 예외나 서버 재시작으로 정리가 누락될 경우 메모리 누수 가능. 또한 `GameState`가 라운드 히스토리(`roundHistory`)를 무한 축적.
- 제안: `roundHistory`에 최근 N개만 유지하는 cap 설정 고려. 게임 복구를 위한 DB 기반 상태 저장도 검토.

---

**[INFO] `useGameStore`의 개별 셀렉터 분산**
- 위치: `frontend/app/game/[roomId]/page.tsx:35-49`
- 상세: 10개 이상의 개별 `useGameStore` 셀렉터 호출. Zustand에서는 각 셀렉터가 독립 구독을 생성하므로 큰 문제는 아니지만 코드 가독성 저하.
- 제안: `useShallow`로 객체 셀렉터 통합하거나 용도별로 분리된 훅으로 추상화.

---

**[INFO] `synchronize: true` (개발/운영 혼용 위험)**
- 위치: `database.module.ts:11`
- 상세: 성능 이슈는 아니지만 프로덕션에서 `synchronize: true`는 스타트업 시 전체 스키마 검사를 수행해 시작 지연 발생 가능.
- 제안: `process.env.NODE_ENV !== 'production'`으로 조건화.

---

### 요약

전반적으로 포커 게임 서버로서 합리적인 설계를 갖추고 있으나, 두 가지 주요 성능 위험이 존재한다. 첫째, `getPlayerHistory`의 N+1 쿼리는 게임 기록이 늘어날수록 응답 시간이 선형으로 증가하며 실제 서비스에서 가장 먼저 병목이 될 수 있다. 둘째, 매 액션마다 `JSON.parse(JSON.stringify(state))`로 전체 게임 상태를 깊은 복사하는 패턴은 현재 규모에서는 허용 가능하지만, 게임 속도가 빠르거나 동시 게임 수가 많아지면 GC 압박의 원인이 된다. 핸드 평가기의 조합 탐색(C(7,5)=21)은 소규모 플레이어 수 기준으로 허용 가능하나 LUT 기반으로 최적화할 여지가 있다. 나머지 이슈들은 현재 사용 규모(SQLite, 소수 동시 게임)에서는 실질적 영향이 적다.

### 위험도

**MEDIUM** — N+1 쿼리와 반복적 전체 상태 복사가 서비스 규모 확대 시 실질적 병목이 되나, 현재 SQLite 기반 소규모 서비스에서는 즉각적 장애 위험은 낮다.