## 아키텍처 코드 리뷰

---

### 발견사항

---

- **[CRITICAL]** `hall-of-fame/page.tsx`의 직접 `BACKEND_URL` 호출이 API 프록시를 우회
  - 위치: `hall-of-fame/page.tsx:29`, `next.config.ts:4-8`
  - 상세: `next.config.ts`에서 `/api/:path*` → `http://localhost:3000/:path*` 프록시를 정의했음에도, 페이지 컴포넌트가 `BACKEND_URL`을 직접 사용. 두 가지 HTTP 접근 전략이 공존하여 CORS 정책, 환경별 배포, 미들웨어 적용 등에서 일관성이 없어짐.
  - 제안: 모든 HTTP 요청을 `/api/*` 프록시 경로를 통하도록 통일하거나, `BACKEND_URL` 직접 접근으로 통일. 둘 중 하나의 전략을 선택해야 함.

---

- **[WARNING]** HTTP API 추상화 계층 부재 — 페이지 컴포넌트가 직접 `fetch` 호출
  - 위치: `hall-of-fame/page.tsx:26-37`, `hall-of-fame/page.tsx:44-54`
  - 상세: 데이터 접근 로직(fetch)이 프레젠테이션 계층(Page 컴포넌트)에 직접 포함되어 있음. 레이어 책임 분리 원칙 위반. URL 변경, 인증 헤더 추가, 에러 처리 표준화 등의 변경이 발생할 때 모든 컴포넌트를 수정해야 함.
  - 제안: `src/lib/api/hall-of-fame.ts`와 같은 API 서비스 레이어 또는 `useHallOfFame()` 훅을 도입하여 데이터 접근 로직을 분리.

---

- **[WARNING]** `useGameStore`가 서로 다른 생명주기의 상태를 단일 스토어에 혼재 — SRP 위반
  - 위치: `src/hooks/useGameStore.ts:15-45`
  - 상세: 로비 상태(`roomList`)와 게임 진행 상태(`gameState`, `holeCards`, `actionRequired`, `showdown`, `gameEnd`)가 하나의 Zustand 스토어에 존재. 로비 컴포넌트가 게임 상태 슬라이스에 접근 가능하고, 게임 컴포넌트가 룸 목록 슬라이스에 접근 가능한 구조가 됨. 또한 로비에서 게임으로 전환 시 `reset()`이 `roomList`를 초기화하지 않지만 게임 상태만 초기화하는 의도가 모호함.
  - 제안: `useLobbyStore`(`roomList`)와 `useGameStore`(`gameState`, `holeCards` 등)로 분리. 생명주기와 도메인이 다른 상태는 별도 스토어로 관리.

---

- **[WARNING]** `ToastProvider`가 상태 관리와 UI 렌더링을 동시에 담당 — SRP 위반
  - 위치: `src/providers/ToastProvider.tsx:43-60`
  - 상세: Provider 컴포넌트가 Context 제공(상태 관리 레이어)과 Toast UI 렌더링(프레젠테이션 레이어)을 동시에 수행. Provider는 상태와 액션만 노출하고, UI는 별도의 `<ToastContainer />` 컴포넌트에서 담당해야 함.
  - 제안: Toast 렌더링 JSX를 별도의 `ToastContainer.tsx`로 분리하고, `layout.tsx`나 최상위에서 명시적으로 렌더링.

---

- **[WARNING]** `page.tsx`(로비)의 `handleCreate` 콜백에서 `data: any` 사용 — 타입 경계 붕괴
  - 위치: `app/page.tsx:51`
  - 상세: `CreateRoomModal`의 `onCreate` 프로퍼티가 명확한 타입(`CreateRoomData`)을 정의하고 있음에도, 소비 측에서 `any`로 받음. 모듈 경계의 타입 계약이 무효화되어 리팩터링 시 컴파일 타임 안전망이 사라짐.
  - 제안: `CreateRoomModal`의 `onCreate` prop 타입과 동일한 타입을 `handleCreate`에 명시적으로 적용.

---

- **[WARNING]** Provider 체인의 암묵적 의존성 순서 — 명시적 계약 없음
  - 위치: `app/providers.tsx:9-13`
  - 상세: `SocketProvider → IdentityProvider → ToastProvider` 순서는 `IdentityProvider`가 `SocketProvider`에 의존한다는 암묵적 가정에 기반. 이 순서가 변경되면 런타임 오류가 발생하나 타입 시스템이 이를 감지하지 못함. 향후 `IdentityProvider`가 Toast를 필요로 하게 될 경우 순서 변경이 쉽지 않음.
  - 제안: 각 Provider의 의존 관계를 주석으로 문서화하거나, 의존성이 없는 Provider들은 순서에 무관하게 동작하도록 설계 검토.

---

- **[INFO]** `HelpModal.tsx`의 `VARIANT_RULES` 키가 `PokerVariant` 타입이 아닌 `string` — 타입 안전성 부족
  - 위치: `src/components/game/HelpModal.tsx:30-42`
  - 상세: `VARIANT_RULES: Record<string, string[]>`으로 선언되어 있어 `PokerVariant` 타입에 존재하지 않는 키로도 접근 가능. `variant`가 추가될 때 컴파일러가 누락을 감지하지 못함.
  - 제안: `Record<PokerVariant, string[]>`으로 변경하여 타입 완전성 보장.

---

- **[INFO]** `PokerTable.tsx`의 `SEAT_POSITIONS` 배열이 최대 플레이어 수에 하드코딩 의존
  - 위치: `src/components/game/table/PokerTable.tsx:16-22`
  - 상세: 좌석 위치가 6개로 하드코딩되어 있으며, 7번째 플레이어 추가 시 `SEAT_POSITIONS[0]`으로 폴백. 스펙 변경(최대 인원 조정) 시 UI와 비즈니스 로직 모두 수정 필요.
  - 제안: 총 플레이어 수와 인덱스를 기반으로 동적으로 위치를 계산하는 함수로 교체.

---

- **[INFO]** `socket.ts`의 모듈 레벨 싱글톤이 Next.js Fast Refresh와 호환 불일치 가능성
  - 위치: `src/lib/socket.ts:5`
  - 상세: `let socket: Socket | null = null`은 모듈 수준 전역 변수. 개발 환경에서 Fast Refresh 시 모듈이 재평가될 수 있으나 소켓 인스턴스가 이미 존재하는 상태가 유지될 수 있음. `SocketProvider`의 cleanup에서 `disconnectSocket()`을 호출하여 `null` 설정 후 재연결하는 방식은 동작하나, HMR 시나리오에서 disconnect 이벤트 없이 모듈이 재로드될 경우 기존 연결이 orphan 상태가 될 수 있음.
  - 제안: `SocketProvider`의 `useEffect` 내에서 소켓을 생성하고 로컬 변수로 관리하거나, 싱글톤 패턴을 유지하되 이 위험성을 주석으로 문서화.

---

### 요약

전체 아키텍처는 Provider 패턴(Context + Zustand)을 통한 상태 분리, 공용 컴포넌트 추상화(`Button`, `Modal`), 타입 시스템 활용 등 Next.js App Router의 권장 방식을 대체로 잘 따르고 있다. 그러나 가장 심각한 문제는 **두 가지 HTTP 접근 전략의 공존**(직접 `BACKEND_URL` vs `/api/*` 프록시)으로, 이는 단순한 코드 스타일 문제가 아니라 배포 환경에서 CORS 오류와 보안 정책 불일치로 이어질 수 있는 아키텍처 결함이다. 그 외에 데이터 접근 로직이 페이지 컴포넌트에 직접 포함된 점, 단일 Zustand 스토어에 서로 다른 생명주기의 상태가 혼재된 점은 중기적으로 유지보수성을 저해할 수 있으므로 API 서비스 레이어 도입과 스토어 분리를 권장한다.

### 위험도

**MEDIUM**