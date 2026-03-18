### 발견사항

- **[WARNING]** `SevenCardStudEngine`에서 `IGameMode.getAnte()` 무시
  - 위치: `seven-card-stud.engine.ts` — `startHand()` 내 ante 수집 블록
  - 상세: `IGameMode` 인터페이스가 `getAnte()` 메서드를 정의하고 있음에도, 스터드 엔진은 `Math.max(1, Math.floor(newState.minRaise / 5))`라는 하드코딩된 공식으로 ante를 독자 계산합니다. 반면 `CashGameMode`와 `TournamentMode`는 모두 `getAnte()`에서 `0`을 반환합니다. 인터페이스 계약이 실질적으로 사용되지 않고 있어 모드 레이어의 책임 경계가 무너집니다.
  - 제안: `mode.getAnte(handNumber)`를 사용하도록 수정하거나, 현재 ante 미지원 상태를 명시적으로 문서화하고 `IGameMode`에서 `getAnte()`를 제거해야 합니다.

- **[WARNING]** `findHighestVisibleHand`에서 단순 합산으로 선행 순서 결정
  - 위치: `seven-card-stud.engine.ts:findHighestVisibleHand`
  - 상세: Seven Card Stud 규칙에 따르면 페어가 하이카드보다 우선합니다. 현재 구현은 보이는 카드 값의 합산만 사용하여 올바른 순서를 보장하지 못합니다. 클래스에 이미 `HandEvaluator`가 주입되어 있으므로 충분히 활용 가능합니다.
  - 제안: `handEvaluator.evaluate(player.visibleCards)`를 사용하거나, 의도적 단순화임을 주석으로 명시해야 합니다.

- **[WARNING]** 드로우 페이즈에서 덱 재활용 로직 불완전
  - 위치: `five-card-draw.engine.ts:handleDraw` — 덱 부족 시 처리 블록
  - 상세: 덱 카드 수가 부족할 때 현재 플레이어가 버린 카드만 섞어 넣습니다. 다른 플레이어들이 이미 버린 카드는 반영되지 않아, 다인원 게임에서 카드 부족이 발생할 수 있습니다.
  - 제안: 게임 상태에 글로벌 폐기 카드 더미를 관리하여 덱 부족 시 전체 폐기 카드를 섞어 복원해야 합니다.

- **[WARNING]** `seven-card-stud.engine.ts:advancePhase` `third-street` 분기에 중복 로직
  - 위치: `seven-card-stud.engine.ts:advancePhase` — `case 'third-street'`
  - 상세: `!player.isFolded && !player.isAllIn`과 `else if (!player.isFolded)` 두 분기 모두 동일한 카드 딜링 코드를 실행합니다. `fourth-street`~`sixth-street`는 단순히 `if (!player.isFolded)`만 사용합니다.
  - 제안: `if (!player.isFolded)` 단일 조건으로 통일하여 불필요한 중복을 제거해야 합니다.

- **[INFO]** `room.service.ts:checkAllReady` 주석과 구현 불일치
  - 위치: `room.service.ts:checkAllReady`
  - 상세: 주석은 "1명이라도 준비되면 AI가 나머지 좌석을 채움"이라고 설명하지만, 구현은 `every()`로 모든 플레이어가 준비 완료되어야 `true`를 반환합니다. AI 채우기 로직은 이 메서드가 아닌 다른 곳(게이트웨이)에 있는 것으로 보입니다.
  - 제안: 오해를 유발하는 주석을 제거하거나 AI 관련 설명을 실제 구현 위치로 이동해야 합니다.

- **[INFO]** `CashGameMode`/`TournamentMode`의 eslint-disable 주석 불필요
  - 위치: `cash-game.mode.ts`, `tournament.mode.ts` — `getSmallBlind`, `getBigBlind`, `getAnte`
  - 상세: `_handNumber`처럼 `_` 접두사를 사용한 파라미터명은 이미 ESLint의 `no-unused-vars` 규칙을 만족합니다. `// eslint-disable-next-line` 주석은 중복입니다.
  - 제안: eslint-disable 주석을 제거해야 합니다.

- **[INFO]** `poker-engine.factory.ts`에 기본 토너먼트 블라인드 스케줄 하드코딩
  - 위치: `poker-engine.factory.ts:createMode`
  - 상세: 기본 블라인드 레벨이 팩토리 내에 인라인으로 정의되어 있습니다. 설정 변경 시 팩토리 코드를 수정해야 합니다.
  - 제안: 별도 상수 또는 설정 파일로 분리하면 유지보수성이 높아집니다.

---

### 요약

대체로 의도된 범위(포커 게임 엔진 및 서비스 레이어 구현) 내에서 작성된 코드이며, 불필요한 리팩토링이나 관련 없는 파일 수정은 발견되지 않았습니다. 그러나 핵심적인 설계 일관성 문제가 존재합니다. `IGameMode.getAnte()` 인터페이스가 정의되어 있으나 실제로 활용되지 않고, 스터드 엔진이 독자적으로 ante를 처리하는 점은 인터페이스 계약을 위반하는 범위 일탈입니다. 또한 드로우 페이즈의 덱 관리 불완전성과 스터드의 선행 순서 결정 로직 단순화는 향후 게임 정확성에 영향을 줄 수 있는 미완성 구현입니다.

### 위험도

**MEDIUM**