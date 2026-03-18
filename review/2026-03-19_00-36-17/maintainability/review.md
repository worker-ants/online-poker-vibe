## 발견사항

### **[WARNING]** BettingControls.tsx: 렌더 중 상태 업데이트 안티패턴
- **위치**: `BettingControls.tsx` 12~15번째 줄
- **상세**: `prevMinRaise`를 이용한 렌더 중 `setState` 호출 패턴은 React 공식 문서에서 권장하지 않는 방식입니다. 이 패턴은 불필요한 추가 렌더를 유발하며, `useEffect`로 명시적으로 처리하는 것이 더 명확합니다.
- **제안**:
  ```tsx
  useEffect(() => {
    setRaiseAmount(actionRequired.minRaise);
  }, [actionRequired.minRaise]);
  ```

---

### **[WARNING]** ai-player.service.ts: 매직 넘버로 가득 찬 decideAction
- **위치**: `ai-player.service.ts`, `decideAction` 메서드 (52~100번째 줄 구간)
- **상세**: `0.8`, `0.6`, `0.4`, `0.2` 핸드 강도 임계값과 `0.1`, `0.05` 블러프 확률이 상수 이름 없이 인라인으로 사용되어 수정 시 의도를 파악하기 어렵습니다.
- **제안**:
  ```ts
  const HAND_STRENGTH = {
    VERY_STRONG: 0.8,
    STRONG: 0.6,
    MEDIUM: 0.4,
    WEAK: 0.2,
  } as const;

  const BLUFF_RATE = {
    MEDIUM: 0.1,
    WEAK: 0.05,
  } as const;
  ```

---

### **[WARNING]** ai-player.service.ts: scoreMap이 HAND_CATEGORY_RANKS와 중복
- **위치**: `ai-player.service.ts`, `evaluateHandStrength` 내 `scoreMap`
- **상세**: `game.types.ts`에 이미 `HAND_CATEGORY_RANKS`가 카테고리별 순위를 정의하고 있음에도 별도의 `scoreMap`을 로컬로 정의하여 정보가 두 곳에 분산됩니다. 핸드 카테고리가 추가될 경우 양쪽을 모두 수정해야 합니다.
- **제안**: `categoryRank`를 직접 정규화하는 방식으로 `scoreMap` 제거:
  ```ts
  return Math.min(0.1 + (categoryRank - 1) * 0.1, 1.0);
  ```
  또는 별도의 `CATEGORY_SCORE_MAP`을 `game.types.ts`에 통합하여 단일 출처로 관리.

---

### **[WARNING]** betting-round.ts: JSON 직렬화 기반 딥클론의 취약성
- **위치**: `betting-round.ts`, `cloneState` 메서드
- **상세**: `JSON.parse(JSON.stringify(state))`는 `Date`, `undefined`, `Map`, `Set` 등 JSON으로 표현 불가능한 타입이 `GameState`에 추가될 경우 조용히 데이터를 손실합니다. 현재는 문제없지만 타입 변경 시 버그 추적이 어렵습니다.
- **제안**: `structuredClone(state)` 사용 (Node.js 17+, 모던 브라우저 지원):
  ```ts
  private cloneState(state: GameState): GameState {
    return structuredClone(state);
  }
  ```

---

### **[INFO]** Card.spec.tsx: 유니코드 이스케이프 사용으로 가독성 저하
- **위치**: `Card.spec.tsx`, 26~43번째 줄
- **상세**: `'\u2665'`, `'\u2660'` 등 이스케이프 코드는 어떤 심볼인지 한눈에 알 수 없습니다.
- **제안**: 테스트 파일 상단에 상수로 추출하거나 실제 문자 사용:
  ```ts
  const SUIT_SYMBOLS = { hearts: '♥', spades: '♠', diamonds: '♦', clubs: '♣' };
  expect(screen.getByText(SUIT_SYMBOLS.hearts)).toBeInTheDocument();
  ```

---

### **[INFO]** PlayerSeat.tsx: 매직 넘버 7
- **위치**: `PlayerSeat.tsx`, `Math.min(cardCount, 7)`
- **상세**: `7`이 Seven Card Stud의 최대 카드 수를 의미하지만 주석이나 상수 없이 인라인으로 사용되어 있습니다.
- **제안**: `const MAX_STUD_CARDS = 7;` 로 추출하거나 명시적 주석 추가.

---

### **[INFO]** PlayerHistoryModal.tsx: 동일 모듈로부터 분산된 import
- **위치**: `PlayerHistoryModal.tsx`, 3~6번째 줄
- **상세**: `@/src/lib/types`에서 두 번의 분리된 import가 있습니다.
- **제안**:
  ```ts
  import { VARIANT_LABELS, MODE_LABELS } from '@/src/lib/types';
  import type { GameHistoryEntry, PokerVariant, GameMode } from '@/src/lib/types';
  ```

---

### **[INFO]** SocketProvider.tsx: socketRef와 socket 상태의 역할 불명확
- **위치**: `SocketProvider.tsx`, 18~19번째 줄
- **상세**: `socketRef`와 `socket` 상태가 동시에 유지되는 이유가 코드만 보고는 바로 이해되지 않습니다. cleanup 시 ref가 필요한 이유에 대한 주석이 있으면 유지보수에 도움이 됩니다.
- **제안**: 각 변수의 역할을 주석으로 명시.

---

## 요약

전반적으로 코드베이스의 유지보수성은 양호한 수준입니다. 컴포넌트 분리, 상수 추출, 팩토리 함수를 이용한 테스트 구성 등 좋은 패턴이 일관되게 적용되어 있습니다. 주요 개선 포인트는 두 곳입니다: `BettingControls`의 렌더 중 setState 안티패턴(불필요한 렌더 유발)과 `AiPlayerService.decideAction`의 매직 넘버 및 중복 `scoreMap`(수정 시 이해 비용 증가)입니다. `betting-round.ts`의 JSON 기반 딥클론도 현재는 동작하지만 타입 확장 시 잠재적 위험이 있어 `structuredClone`으로 교체를 권장합니다.

## 위험도

**LOW**