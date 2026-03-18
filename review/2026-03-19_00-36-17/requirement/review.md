### 발견사항

---

**[CRITICAL] `RoomState` 타입 불일치 - 필수 필드 누락**
- 위치: `frontend/src/hooks/useGameStore.spec.ts` (여러 곳)
- 상세: `types.ts`의 `RoomState` 인터페이스는 `settings: RoomSettings`를 필수 필드로 정의하지만, 테스트 코드의 mock 객체들에 해당 필드가 누락되어 TypeScript 컴파일 오류 발생
- 제안: 테스트의 mock 객체에 `settings: { startingChips: 1000, smallBlind: 10, bigBlind: 20 }` 추가

---

**[CRITICAL] `CreateRoomModal` - `ante` 및 `blindSchedule` 설정 불가**
- 위치: `frontend/src/components/lobby/CreateRoomModal.tsx`, `onCreate` 콜백 타입 및 `handleSubmit`
- 상세: `CreateRoomModal`의 `onCreate` 콜백 타입과 `handleSubmit` 구현이 `startingChips`, `smallBlind`, `bigBlind`만 전달하며 `ante`와 `blindSchedule`을 포함하지 않음. Seven Card Stud는 ante가 필수이고, Tournament 모드는 blind schedule이 핵심 기능인데 UI에서 설정할 방법이 없음
- 제안: `onCreate` 타입에 `settings: RoomSettings`로 확장하고, Seven Card Stud 선택 시 ante 입력 필드, Tournament 모드 선택 시 blind schedule 설정 UI 추가

---

**[WARNING] `BettingControls` - 타이머 미표시**
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx`
- 상세: `ActionRequired.timeLimit`이 전달되지만 UI에 전혀 표시되지 않음. 플레이어가 자신에게 남은 시간을 알 수 없으며, 타임아웃 시 강제 폴드 처리가 될 경우 사용자 경험에 심각한 문제
- 제안: `timeLimit`을 prop으로 받아 카운트다운 타이머 컴포넌트로 표시

---

**[WARNING] `CommunityCards` - 프리플롭에서 보드 영역 비표시**
- 위치: `frontend/src/components/game/table/CommunityCards.tsx:12`
- 상세: `cards.length === 0`이면 `null` 반환. 프리플롭에서 커뮤니티 카드 영역 자체가 사라져 테이블 레이아웃이 불안정해지고 5장의 빈 슬롯을 표시하지 않아 포커 테이블의 맥락을 전달하지 못함
- 제안: `cards.length === 0`일 때도 5개의 빈 placeholder 슬롯 렌더링

---

**[WARNING] `PotDisplay` - 사이드팟 단일 개 미표시**
- 위치: `frontend/src/components/game/table/PotDisplay.tsx:14`
- 상세: `sidePots.length > 1` 조건으로 인해 사이드팟이 정확히 1개인 경우 표시되지 않음. All-in이 발생하여 사이드팟이 1개 생겼을 때 플레이어들이 팟 구조를 알 수 없음
- 제안: 조건을 `sidePots && sidePots.length >= 1`로 변경

---

**[WARNING] `BettingControls` - render 중 state 업데이트 (React 안티패턴)**
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx:13-17`
- 상세: render 함수 실행 중 `setPrevMinRaise`와 `setRaiseAmount`를 호출하는 패턴은 React 공식 문서에서 경고하는 안티패턴. 동작은 하지만 StrictMode에서 이중 렌더링 문제나 예상치 못한 부작용 발생 가능
- 제안: `useEffect(() => { setRaiseAmount(actionRequired.minRaise); }, [actionRequired.minRaise])` 패턴으로 교체

---

**[WARNING] `PlayerSeat` - 카드 수 하드코딩**
- 위치: `frontend/src/components/game/table/PlayerSeat.tsx:47`
- 상세: `Math.min(cardCount, 7)`에서 `7`은 Seven Card Stud 전용 상수. Texas Hold'em(2장)이나 Five Card Draw(5장)에서도 최대 7장까지 빈 카드 슬롯을 보여줄 수 있음
- 제안: 게임 variant에 따라 최대 카드 수를 동적으로 결정하거나, `variant` prop을 추가하여 조건 처리

---

**[INFO] `HelpModal` - variant 없을 때 규칙 섹션 미표시**
- 위치: `frontend/src/components/game/HelpModal.tsx:47`
- 상세: `variant`가 undefined이면 `rules` 변수는 `texas-holdem` 규칙으로 설정되지만 `{variant && (...)}` 조건으로 인해 렌더링되지 않음. 계산된 값이 사용되지 않는 데드코드 발생
- 제안: variant 없을 때 기본값(`texas-holdem`)으로 규칙을 보여주거나, `rules` 변수 계산 자체를 제거

---

**[INFO] `BettingRound.getValidActions` - chips 부족 시 call 불가능 케이스**
- 위치: `backend/src/game/engine/betting-round.ts:26-29`
- 상세: `player.chips < callAmount`인 경우 'call'이 목록에서 제외되고 'all-in'만 가능. 비즈니스적으로 올바른 동작이나, 이 경우 'all-in'의 의미가 "콜에 해당하는 all-in"임에도 UI에서 구분이 되지 않을 수 있음

---

### 요약

전체적으로 코드 구조와 컴포넌트 설계는 명확하고 테스트 커버리지도 적절하게 작성되어 있으나, 요구사항 충족 관점에서 몇 가지 중요한 결함이 있습니다. 가장 심각한 것은 `CreateRoomModal`이 `ante`와 `blindSchedule`을 설정할 수 없어 Seven Card Stud와 Tournament 모드의 핵심 기능이 사실상 동작하지 않는다는 점이며, `RoomState` 타입 불일치로 인한 컴파일 오류도 즉시 수정이 필요합니다. 게임플레이 UX 측면에서는 타이머 미표시, 프리플롭 보드 영역 비표시, 사이드팟 단일 개 미표시 등이 플레이어 경험을 저해할 수 있습니다.

### 위험도

**HIGH**