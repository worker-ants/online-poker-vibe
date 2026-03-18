## 발견사항

### [CRITICAL] `useGameStore.spec.ts` — RoomState 타입 불일치
- **위치**: `useGameStore.spec.ts`, `setCurrentRoom` 테스트 fixture
- **상세**: `RoomState` 인터페이스는 `settings: RoomSettings`를 필수 필드로 정의하지만 테스트 fixture에서 누락됨. TypeScript 컴파일 에러 발생.
- **제안**: `settings: { startingChips: 1000, smallBlind: 10, bigBlind: 20 }` 필드 추가

### [CRITICAL] `ai-player.service.spec.ts` — Jest API 사용
- **위치**: `decideAction` describe 블록, `jest.spyOn` / `jest.restoreAllMocks()` 사용 부분
- **상세**: 프로젝트가 Vitest 기반임에도 `jest.spyOn`, `jest.restoreAllMocks()` 사용. 전역 `jest` 객체는 Vitest에서 기본 제공되지 않으므로 런타임 에러 발생 가능. 또한 `describe`, `it`, `expect`를 `vitest`에서 import하지 않음 (globals 설정 의존).
- **제안**: `vi.spyOn(...)` / `vi.restoreAllMocks()`로 교체, `import { describe, it, expect, vi, beforeEach } from 'vitest'` 추가

### [WARNING] `BettingControls.spec.tsx` — raise 액션 테스트 누락
- **위치**: `BettingControls.spec.tsx` 전체
- **상세**: `onAction('raise', amount)` 호출 검증 없음. Raise 버튼 클릭 시 금액이 올바르게 전달되는지 미검증. All-in 버튼 렌더링 및 클릭 테스트도 없음. 슬라이더/숫자 입력 상호작용 미테스트.
- **제안**:
  ```typescript
  it('should call onAction with raise and amount when raise clicked', () => {
    fireEvent.click(screen.getByText(/Raise to/));
    expect(onAction).toHaveBeenCalledWith('raise', 40); // minRaise=40
  });
  it('should render all-in button', () => {
    expect(screen.getByText('All-in')).toBeInTheDocument();
  });
  ```

### [WARNING] `useGameStore.spec.ts` — showdown / gameEnd setter 미검증
- **위치**: `useGameStore.spec.ts`
- **상세**: `setShowdown`, `setGameEnd` 액션에 대한 테스트 없음. 또한 `reset()` 후 `showdown`, `gameEnd`가 null로 초기화되는지 검증 안 됨.
- **제안**: 두 setter에 대한 기본 테스트 및 reset 후 null 검증 테스트 추가

### [WARNING] 주요 컴포넌트 테스트 전무
- **위치**: 아래 파일들
- **상세**: 비즈니스 로직을 포함한 컴포넌트들에 테스트 없음:
  - `PokerTable.tsx` — 플레이어 좌석 재정렬 로직 (`myIndex` 기반)
  - `PlayerSeat.tsx` — 홀카드/공개카드 표시 분기 로직
  - `CommunityCards.tsx` — 빈 플레이스홀더 렌더링 로직
  - `NicknameInput.tsx` — 비동기 제출, 편집 상태 관리
  - `CreateRoomModal.tsx` — 폼 검증, 제출 핸들링
  - `Modal.tsx` — `document.body.overflow` 사이드 이펙트
  - `IdentityProvider.tsx` — 소켓 이벤트 핸들링, setNickname 비동기 로직
  - `useRoomList.ts` — 소켓 emit/on 통합 로직
- **제안**: 특히 `PokerTable`의 좌석 재정렬, `NicknameInput`의 제출 흐름, `Modal`의 overflow 처리는 회귀 위험도가 높으므로 우선 테스트 작성 필요

### [WARNING] `SocketProvider.spec.tsx` — unmount-before-fetch 테스트 신뢰도
- **위치**: `'should not connect socket if unmounted before fetch completes'` 테스트
- **상세**: `vi.mock`으로 모킹된 `getSocket`이 테스트 파일 수준에서 캐싱되므로 이전 테스트에서 이미 호출된 경우 assertion이 올바르지 않을 수 있음. `mockClear()` 또는 `mockReset()` 호출 없이 `not.toHaveBeenCalled()` 단언은 불안정함.
- **제안**: `beforeEach`에서 `vi.clearAllMocks()` 호출이 이미 있지만, 해당 테스트는 동적 import(`await import(...)`) 후 assertion하므로 별도 mock reference를 유지하는 방식으로 리팩토링 필요

### [WARNING] `betting-round.spec.ts` — 미검증 public 메서드
- **위치**: `BettingRound` 클래스
- **상세**: `resetForNewRound`, `isOnlyOnePlayerRemaining`, `findNextActivePlayer` 메서드에 대한 테스트 없음. 특히 `findNextActivePlayer`는 모든 플레이어가 folded/all-in일 때 `-1`을 반환하는 엣지케이스 미검증.
- **제안**: 세 메서드에 대한 단위 테스트 추가

### [INFO] `Card.spec.tsx` — 의미 없는 assertion
- **위치**: `'should render card back when no card provided'` 테스트, 라인 `expect(container.firstChild).toBeDefined()`
- **상세**: `container.firstChild`는 React가 렌더링하면 항상 존재하므로 이 assertion은 실질적 가치 없음.
- **제안**: 제거하거나 CSS 클래스 검증으로 대체 (`expect(container.firstChild).toHaveClass('bg-gradient-to-br')`)

### [INFO] `deck.spec.ts` — 셔플 테스트의 확률적 불안정성
- **위치**: `'should shuffle and produce different order'` 테스트
- **상세**: 셔플 후 동일 순서가 나올 확률은 1/52! 이므로 실용적으로 문제없지만, 결정론적이지 않음.
- **제안**: 셔플 전후 순서 비교 대신 `Deck.shuffle`에 시드 주입 가능한 구조로 변경하거나 현재 수준 유지

---

## 요약

핵심 게임 엔진(Deck, BettingRound)과 공통 UI 컴포넌트(Button, Card, GameRulesPanel)는 합리적인 테스트 커버리지를 갖추고 있으나, 두 가지 심각한 문제가 있다: `ai-player.service.spec.ts`에서 Jest API(`jest.spyOn`)를 Vitest 환경에서 사용하여 런타임 에러가 발생할 수 있고, `useGameStore.spec.ts`의 RoomState 픽스처에서 필수 필드 누락으로 TypeScript 컴파일 에러가 발생한다. 또한 게임의 핵심 UI인 `PokerTable`, `PlayerSeat`, `NicknameInput` 등 복잡한 컴포넌트들이 테스트 없이 방치되어 있어 회귀 위험도가 높으며, BettingControls의 raise 액션 콜백 검증 누락은 게임 베팅 흐름의 정확성을 보장하지 못한다.

## 위험도

**HIGH**