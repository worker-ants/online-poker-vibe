### 발견사항

---

**[CRITICAL] 프론트엔드-백엔드 타입 중복 정의**
- 위치: `frontend/src/lib/types.ts` ↔ `backend/src/common/types/`
- 상세: `Card`, `PokerVariant`, `GameMode`, `BettingAction`, `ActionRequired`, `PublicGameState` 등 핵심 도메인 타입이 양쪽에 독립적으로 중복 정의되어 있음. Monorepo 구조임에도 공유 패키지(`packages/shared` 등)가 없음. 백엔드 `GameState`의 `phase` 필드는 `GamePhase` 유니온 타입인 반면, 프론트엔드 `types.ts`의 `GamePhase`는 다른 멤버 구성(`pre-deal`, `deal` 포함)을 가짐. 두 타입 시스템이 동기화되지 않으면 런타임 불일치 버그가 무증상으로 잠복함.
- 제안: `packages/shared` 공유 패키지를 생성하여 양측이 동일한 타입과 이벤트 상수를 import하도록 구조 변경. 같은 이유로 `WS_EVENTS` 상수도 동일하게 중복되어 있어 함께 이전 필요.

---

**[WARNING] `SocketProvider`의 단일 책임 원칙 위반**
- 위치: `frontend/src/providers/SocketProvider.tsx:30-50`
- 상세: HTTP 요청(`fetch /player/me`)과 WebSocket 생명주기 관리가 하나의 Provider에 혼재. `/player/me`는 플레이어 세션 초기화 목적이며 `IdentityProvider`의 관심사와 더 가깝지만, Socket 연결 타이밍에 의존성이 있어 강제로 결합됨.
- 제안: `PlayerSessionInitializer` 같은 별도 훅이나 컴포넌트를 두어 쿠키 초기화 관심사를 분리하거나, `IdentityProvider`에서 세션 초기화 후 소켓 연결을 허용하는 신호를 내보내는 구조로 변경.

---

**[WARNING] `BettingControls`의 파생 상태 관리 안티패턴**
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx:14-17`
- 상세: 렌더 중 `setPrevMinRaise` / `setRaiseAmount`를 직접 호출하는 패턴은 React 공식 문서에서 명시적으로 anti-pattern으로 분류. 해당 코드는 렌더 사이클 중 추가 렌더를 강제 발생시킴.
- 제안: `useEffect`를 `actionRequired.minRaise` 의존성으로 사용하거나, `raiseAmount`를 `useState` 대신 `minRaise`를 초기값으로 받는 controlled value로 처리.

---

**[WARNING] `types.ts`에 런타임 상수와 타입 혼재**
- 위치: `frontend/src/lib/types.ts:103-113`
- 상세: `VARIANT_LABELS`, `MODE_LABELS`가 타입 정의 파일에 함께 존재. 타입 파일에 런타임 값이 혼재하면 타입 전용 import가 불가능해지고, 번들러 tree-shaking에서 타입이 런타임 의존성처럼 처리될 수 있음.
- 제안: `frontend/src/lib/constants.ts` 또는 `frontend/src/lib/labels.ts`로 분리.

---

**[WARNING] `AiPlayerService`가 게임 엔진 도메인 로직을 침범**
- 위치: `backend/src/ai/ai-player.service.ts:93-145`
- 상세: `evaluateHandStrength`, `preFlopStrength`, `basicCardStrength` 메서드는 순수한 게임 도메인 로직(핸드 강도 평가)임에도 AI 서비스에 내포됨. 또한 `AiPlayerService`가 `HandEvaluator`를 직접 인스턴스화(`new HandEvaluator()`)하여 의존성 역전 원칙 위반.
- 제안: `HandEvaluator`를 DI로 주입받도록 변경. 핸드 강도 평가 로직은 `HandEvaluator` 또는 별도 `HandStrengthEvaluator`로 이전하여 AI 서비스는 전략 결정에만 집중.

---

**[WARNING] `HelpModal`에 게임 도메인 데이터 하드코딩**
- 위치: `frontend/src/components/game/HelpModal.tsx:13-42`
- 상세: `HAND_RANKINGS`, `VARIANT_RULES`가 UI 컴포넌트에 직접 정의. 새로운 변형(variant) 추가 시 UI 컴포넌트를 수정해야 하는 개방-폐쇄 원칙 위반. 동일한 규칙 데이터가 필요한 다른 컴포넌트에서 재사용 불가.
- 제안: `lib/game-rules.ts` 또는 별도 상수 파일로 추출.

---

**[WARNING] `CommunityCards`의 Texas Hold'em 전용 하드코딩**
- 위치: `frontend/src/components/game/table/CommunityCards.tsx:15`
- 상세: `5 - cards.length` 플레이스홀더는 Texas Hold'em 전제. Seven Card Stud는 커뮤니티 카드가 없고, Five Card Draw도 없음. 해당 컴포넌트가 `variant`를 props로 받지 않아 다른 게임 변형에서 잘못된 UI 렌더링 가능.
- 제안: `maxCards` props를 추가하거나, variant별 플레이스홀더 수를 외부에서 제어하도록 변경.

---

**[WARNING] `BettingRound.cloneState`의 타입 안전성 손실**
- 위치: `backend/src/game/engine/betting-round.ts:215`
- 상세: `JSON.parse(JSON.stringify(state)) as GameState`는 타입 캐스팅만 있을 뿐 실제 타입 검증 없음. 게임 엔진의 핫 패스에서 반복 호출 시 성능 비용도 존재.
- 제안: `structuredClone(state)`로 대체(Node.js 17+)하거나, 변경이 필요한 필드만 스프레드 연산자로 불변 업데이트하는 패턴 적용.

---

**[WARNING] `GameHistoryEntry` 타입에서 `variant`/`mode` 필드가 `string`**
- 위치: `frontend/src/lib/types.ts:80-88`, `frontend/src/components/hall-of-fame/PlayerHistoryModal.tsx:40`
- 상세: `GameHistoryEntry.variant`와 `mode`가 `string` 타입이어서 `PlayerHistoryModal`에서 `as PokerVariant`로 강제 캐스팅 필요. 잘못된 값에 대해 컴파일 타임 보호가 없음.
- 제안: `GameHistoryEntry.variant`를 `PokerVariant`, `mode`를 `GameMode`로 타입 강화.

---

**[INFO] `socket.ts` 모듈 레벨 싱글톤**
- 위치: `frontend/src/lib/socket.ts:5`
- 상세: 모듈 레벨 변수 `let socket: Socket | null = null`은 Next.js SSR 환경에서 서버/클라이언트 경계를 의식하지 않으면 예기치 않은 동작 가능. `'use client'` 지시어가 있어 현재는 안전하나, 빌드 구성 변경 시 위험 요소.
- 제안: 현재 구조 유지 시 문서화로 명시. 장기적으로는 Context 주입 방식으로 전환 고려.

---

**[INFO] `GameLayout`의 불필요한 `'use client'`**
- 위치: `frontend/src/components/game/GameLayout.tsx:1`
- 상세: 순수 레이아웃 컴포넌트로 `ReactNode` 슬롯만 렌더링하며 클라이언트 API를 사용하지 않음. Server Component로 선언 가능.
- 제안: `'use client'` 제거하여 Server Component로 최적화.

---

**[INFO] `PotDisplay`의 인라인 타입 정의**
- 위치: `frontend/src/components/game/table/PotDisplay.tsx:4`
- 상세: `sidePots?: { amount: number; playerUuids: string[] }[]`가 인라인 정의됨. `types.ts`에 이미 동일한 구조의 `SidePot` 인터페이스가 있음에도 재사용하지 않음.
- 제안: `import type { SidePot }` 후 타입 참조.

---

### 요약

전반적인 컴포넌트 분리와 레이어 구조는 양호하나, **Monorepo임에도 공유 타입/상수 패키지가 없다는 것이 가장 큰 아키텍처 결함**이다. 프론트엔드와 백엔드가 동일한 도메인 타입을 독립적으로 관리하면서 이미 `GamePhase` 정의 차이처럼 타입 드리프트가 발생하고 있다. 백엔드 게임 엔진 레이어(`BettingRound`, `Deck`)는 책임이 명확하게 분리되어 있으나, `AiPlayerService`가 게임 도메인 평가 로직을 직접 보유하면서 게임 엔진과의 경계가 흐려진다. 프론트엔드는 Zustand + Provider 조합으로 상태 관리가 잘 구조화되어 있고 컴포넌트 책임 분리도 대체로 적절하나, `BettingControls`의 파생 상태 안티패턴과 `SocketProvider`의 복합 책임은 개선이 필요하다.

### 위험도

**HIGH** — 타입 중복에 의한 프론트-백엔드 타입 드리프트가 런타임에서만 감지되는 버그를 유발할 수 있으며, 현재 이미 일부 불일치(`GamePhase` 멤버)가 확인됨.