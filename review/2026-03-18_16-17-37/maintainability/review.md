## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `handleCreate`의 `data` 파라미터에 `any` 타입 사용
- 위치: `frontend/app/page.tsx:44`
- 상세: `(data: any)` 타입은 TypeScript의 이점을 무효화하며, 타입 오류를 런타임까지 숨깁니다. `CreateRoomModal`의 `onCreate` prop에 이미 상세한 타입이 정의되어 있어 불일치가 발생합니다.
- 제안: `CreateRoomModal`의 `onCreate` 콜백 타입과 동일한 타입을 사용하거나 `types.ts`에서 별도 타입을 추출하여 사용

---

**[WARNING]** `BettingControls`의 `raiseAmount` 초기화 후 `actionRequired` 변경 시 미동기화
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx:13`
- 상세: `useState(actionRequired.minRaise)`는 최초 렌더 시에만 초기화됩니다. 부모에서 `actionRequired`가 새 값으로 교체되어도 `raiseAmount`는 이전 값을 유지할 수 있습니다.
- 제안: `useEffect`로 `actionRequired.minRaise` 변경 시 `setRaiseAmount` 동기화

---

**[WARNING]** `PokerTable`의 좌석 배치 로직이 인라인에 위치
- 위치: `frontend/src/components/game/table/PokerTable.tsx:27-34`
- 상세: 플레이어 재정렬 로직(`myIndex` 기반 rotate)이 컴포넌트 바디 안에 인라인으로 있어 테스트와 재사용이 불가능합니다.
- 제안: `reorderPlayersFromMyPerspective(players, myUuid)` 순수 함수로 추출

---

**[INFO]** `SEAT_POSITIONS` 배열 크기(6)와 최대 플레이어 수의 암묵적 연결
- 위치: `frontend/src/components/game/table/PokerTable.tsx:15-21`
- 상세: `SEAT_POSITIONS`가 6개 고정인데 이는 스펙의 `maxPlayers: 6`과 연관되지만, 배열 크기 초과 시 `SEAT_POSITIONS[0]`으로 fallback되어 시각적 버그가 발생합니다.
- 제안: 상수명으로 의도를 명시하거나 `MAX_PLAYERS = 6` 상수와 연결하여 일관성 확보

---

**[INFO]** `HelpModal`의 `VARIANT_RULES` 폴백 처리 불일치
- 위치: `frontend/src/components/game/HelpModal.tsx:50`
- 상세: `variant`가 없을 때 `VARIANT_RULES['texas-holdem']`으로 폴백하지만, 그 아래 `{variant && (...)}` 조건으로 인해 폴백된 rules는 실제로 렌더링되지 않아 `rules` 변수 할당이 무의미합니다.
- 제안: `rules` 변수를 `variant`가 있을 때만 조건부로 사용하거나 폴백 로직을 제거

---

**[INFO]** `ToastProvider`의 모듈 레벨 변수 `toastId`
- 위치: `frontend/src/providers/ToastProvider.tsx:23`
- 상세: `let toastId = 0`이 모듈 레벨에 선언되어 있어 HMR(Hot Module Replacement) 환경에서 예기치 않은 상태가 될 수 있습니다. `useRef`나 `crypto.randomUUID()` 사용이 더 안전합니다.
- 제안: `useRef`로 ID 카운터 관리 또는 `Date.now() + Math.random()` 방식 사용

---

**[INFO]** `PlayerHistoryModal`의 중복 import
- 위치: `frontend/src/components/hall-of-fame/PlayerHistoryModal.tsx:3-5`
- 상세: `import type { ... } from '@/src/lib/types'`가 두 줄로 분리되어 있습니다. 같은 모듈에서의 import는 하나로 합치는 것이 표준입니다.
- 제안: 두 import를 하나로 합침

---

**[INFO]** `next.config.ts`의 백엔드 URL 하드코딩
- 위치: `frontend/next.config.ts:6`
- 상세: `http://localhost:3000`이 하드코딩되어 있어 배포 환경에서 별도 수정이 필요합니다.
- 제안: `process.env.BACKEND_URL ?? 'http://localhost:3000'`으로 환경변수화

---

**[INFO]** `CommunityCards`의 `key` prop으로 array index 사용
- 위치: `frontend/src/components/game/table/CommunityCards.tsx:16`
- 상세: 카드 목록에서 `key={i}` 사용은 카드가 앞쪽에 삽입/삭제될 때 React의 재조정(reconciliation) 최적화를 방해할 수 있습니다. 카드 객체는 suit+rank로 유일하게 식별 가능합니다.
- 제안: `key={`${card.suit}-${card.rank}`}` 사용

---

### 요약

전반적으로 코드 구조는 잘 설계되어 있습니다. Provider 패턴, Zustand 스토어 분리, 공유 컴포넌트(`Button`, `Modal`) 추출 등 유지보수 관점에서 올바른 방향입니다. 타입 시스템도 충실히 활용되고 있습니다. 다만 `any` 타입 사용, `BettingControls`의 상태 동기화 문제, `PokerTable`의 비즈니스 로직 인라인 배치 등 중간 수준의 개선 사항이 있습니다. 모듈 레벨 변수(`toastId`)나 하드코딩된 URL 같은 소소한 문제들도 장기적으로 버그나 운영 불편을 초래할 수 있어 조치를 권장합니다.

### 위험도

**LOW**