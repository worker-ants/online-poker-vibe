### 발견사항

---

**[CRITICAL]** 7-카드 스터드 스트릿 베팅 순서 오류
- 위치: `seven-card-stud.engine.ts` → `findHighestVisibleHand()`
- 상세: 4~7번째 스트릿에서 베팅 순서를 결정할 때 공개된 카드의 숫자 합산으로 비교. 페어(2+2=4)가 에이스(14)보다 낮게 평가되는 등 실제 포커 규칙(공개 패 기준 최고 핸드가 먼저 베팅)과 불일치.
- 제안: `HandEvaluator.evaluate(visibleCards)`로 실제 핸드 랭크를 비교하거나, 최소한 공개 카드 중 가장 높은 단일 카드 기준으로 정렬

---

**[WARNING]** `IGameMode.getAnte()` 인터페이스와 실제 구현 불일치
- 위치: `game-mode.interface.ts`, `tournament.mode.ts`, `cash-game.mode.ts`, `seven-card-stud.engine.ts`
- 상세: `IGameMode` 인터페이스에 `getAnte(handNumber)` 메서드가 정의되어 있으나 두 구현체 모두 `0`을 반환. 7-카드 스터드 엔진은 이 메서드를 사용하지 않고 `Math.floor(minRaise / 5)`를 자체 계산하여 모드 설정이 앤티에 반영되지 않음.
- 제안: 엔진에서 `mode.getAnte(handNumber)` 호출로 교체하고, 각 모드 구현체에서 실제 앤티 값 반환

---

**[WARNING]** 5-카드 드로 덱 소진 시 재셔플 불완전
- 위치: `five-card-draw.engine.ts` → `handleDraw()` (약 180번째 라인)
- 상세: 카드가 부족할 때 현재 플레이어가 버린 카드만 덱에 추가하여 셔플. 이전에 드로한 다른 플레이어들의 버린 카드를 포함시키지 않아 실제 포커 규칙과 다름. 코드 내 `// (simplified: ...)` 주석으로 명시되어 있어 의도적 미완성.
- 제안: `GameState`에 `discardPile` 필드를 추가하여 모든 플레이어의 버린 카드를 추적하고 재셔플 시 활용

---

**[WARNING]** `advancePhase` 4번째 스트릿 처리 중복 분기
- 위치: `seven-card-stud.engine.ts` → `advancePhase()` case `'third-street'`
- 상세: `!isFolded && !isAllIn` 분기와 `else if (!isFolded)` 분기 모두 동일하게 `visibleCards.push()`를 실행. 조건이 다를 뿐 로직이 동일하여 코드 의도와 구현 불일치 가능성.
- 제안: `if (!player.isFolded)` 단일 조건으로 통합

---

**[WARNING]** `getPlayerHistory` 무한 데이터 반환
- 위치: `hall-of-fame.service.ts` → `getPlayerHistory()`
- 상세: 플레이어 전체 게임 이력을 페이지네이션 없이 반환. 게임 수가 많을 경우 대용량 응답 발생.
- 제안: `limit`/`offset` 파라미터 추가 또는 최근 N개 제한

---

**[WARNING]** Texas Hold'em `resolveHand` 반환 카드 불일치
- 위치: `texas-holdem.engine.ts` → `resolveHand()` (약 155번째 라인)
- 상세: `handRank`는 `[...p.holeCards, ...state.communityCards]` 7장으로 평가하나 `playerHands`의 `cards` 필드에는 `p.holeCards` 2장만 저장. 쇼다운 표시 시 공용 카드가 누락.
- 제안: `cards: [...p.holeCards, ...state.communityCards]` 또는 `bestFive` 필드 별도 추가

---

**[WARNING]** `startGame` AI/인간 플레이어 좌석 중복 미검증
- 위치: `game.service.ts` → `startGame()`
- 상세: 인간 플레이어와 AI 플레이어를 합칠 때 `seatIndex` 중복 여부를 검증하지 않음. 방 서비스에서 AI 좌석 배정 시 중복이 발생하면 게임 상태가 오염될 수 있음.
- 제안: 합치기 전 seatIndex Set으로 중복 확인 후 예외 처리

---

**[INFO]** `checkAllReady` 주석과 구현 불일치
- 위치: `room.service.ts` → `checkAllReady()`
- 상세: 주석은 "1명이라도 준비되면"이라고 설명하나, 실제 구현은 `every((rp) => rp.isReady)`로 전원 준비 확인.
- 제안: 주석을 구현에 맞게 수정

---

**[INFO]** `hand-evaluator.spec.ts` 6장 핸드 테스트 없음
- 위치: `hand-evaluator.spec.ts`
- 상세: 5장, 7장 테스트는 존재하나 6장(Omaha 변형 등 가능성)은 미포함. `evaluate()`는 6장도 허용하나 검증 없음.

---

### 요약

전반적으로 포커 게임의 핵심 로직(핸드 평가, 팟 계산, 블라인드 구조)은 잘 구현되어 있으나, 7-카드 스터드의 스트릿 베팅 순서 결정 로직이 카드 합산 방식이라는 근본적인 규칙 위반이 존재하며, `IGameMode.getAnte()` 인터페이스가 실제로 활용되지 않아 모드 설정과 엔진 동작 간의 결합이 깨진 상태이다. 5-카드 드로의 덱 재셔플은 미완성 상태가 명시되어 있어 추후 수정이 필요하고, Texas Hold'em 쇼다운 결과의 `cards` 필드가 홀 카드만 포함하는 점도 클라이언트 표시에서 혼란을 줄 수 있다.

### 위험도
**HIGH**