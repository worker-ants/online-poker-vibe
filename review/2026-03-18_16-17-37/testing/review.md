## 발견사항

### [CRITICAL] 테스트 파일 전무 - 34개 파일에 단 하나의 테스트도 없음
- **위치**: 전체 프론트엔드 코드베이스
- **상세**: 신규 추가된 모든 파일(컴포넌트, 훅, 프로바이더, 유틸리티)에 테스트 파일이 존재하지 않습니다. SDD/TDD 방법론을 따르도록 명시된 CLAUDE.md 지침에 정면으로 위배됩니다.
- **제안**: 각 파일에 대응하는 `*.test.tsx` / `*.spec.ts` 파일 작성 필요

---

### [CRITICAL] `handleCreate`의 `any` 타입 — 타입 안전성 테스트 불가
- **위치**: `app/page.tsx:52` — `(data: any)`
- **상세**: `any` 타입 사용으로 잘못된 페이로드가 소켓으로 전송되어도 컴파일/테스트 단계에서 감지 불가
- **제안**: `CreateRoomModal`의 `onCreate` 타입과 동일한 구체 타입으로 교체

---

### [CRITICAL] 모듈 레벨 가변 상태 (`toastId`) — 테스트 격리 파괴
- **위치**: `src/providers/ToastProvider.tsx:26` — `let toastId = 0`
- **상세**: 모듈 레벨의 카운터가 테스트 간에 공유되어 독립적 테스트 불가. Jest에서 모듈을 `jest.resetModules()` 없이 재사용하면 ID가 누적됩니다.
- **제안**: `useRef`나 `useState`로 ID 관리를 컴포넌트 스코프 내부로 이동

---

### [CRITICAL] 소켓 싱글톤 패턴 — 단위 테스트 불가
- **위치**: `src/lib/socket.ts` — 모듈 레벨 `let socket: Socket | null = null`
- **상세**: 싱글톤으로 관리되는 소켓은 Jest 환경에서 각 테스트마다 상태를 리셋하기 어렵습니다. `SocketProvider`, `useRoomList`, `IdentityProvider` 등 소켓 의존 코드 전체가 테스트하기 어려운 구조.
- **제안**: 소켓 팩토리를 주입받을 수 있도록 `SocketProvider`에 `socketFactory` prop 추가 또는 DI 패턴 도입

---

### [WARNING] 무음 에러 처리 — 오류 경로 테스트 불가능
- **위치**: `app/hall-of-fame/page.tsx:37` (`catch {}`), `page.tsx:53` (`catch { // ignore }`)
- **상세**: 오류가 완전히 삼켜져 실패 시나리오를 테스트로 검증할 방법이 없습니다. 네트워크 오류, 서버 오류 응답 등이 UI에 반영되지 않음.
- **제안**: 에러 상태를 `useState`로 관리하고 UI에 표시, 테스트에서 mock fetch 실패 시 오류 메시지 렌더링 검증

---

### [WARNING] HallOfFamePage — fetch 취소 없음, 경쟁 조건 미테스트
- **위치**: `app/hall-of-fame/page.tsx:24-40`
- **상세**: `useEffect` 내 `fetch`에 `AbortController`가 없어 빠른 페이지 전환 시 메모리 누수 및 상태 업데이트 경고 발생 가능. 이 경쟁 조건을 테스트로 검증하는 코드가 없음.
- **제안**: `AbortController`로 cleanup에서 fetch 취소 + 관련 테스트 작성

---

### [WARNING] BettingControls — number input 범위 미검증
- **위치**: `src/components/game/sidebar/BettingControls.tsx:59-63`
- **상세**: `<input type="number">`에 `min`/`max` HTML 속성이 있어도 직접 입력 시 범위를 벗어난 값이 상태에 저장됩니다. `raiseAmount`가 `minRaise`보다 작거나 `maxRaise`보다 큰 값으로 소켓 이벤트 전송 가능.
- **제안**: `onChange` 핸들러에서 `Math.min(maxRaise, Math.max(minRaise, value))` 클램핑 + 테스트

---

### [WARNING] PokerTable — 플레이어 재정렬 로직 테스트 부재
- **위치**: `src/components/game/table/PokerTable.tsx:32-37`
- **상세**: 자신의 인덱스 기준으로 플레이어 배열을 재정렬하는 로직이 복잡하지만 테스트가 없습니다. `myIndex === 0`, `myIndex > 0`, `myUuid === null`, 7명 이상 등의 엣지 케이스 미검증.
- **제안**: 순수 함수로 추출 후 단위 테스트 작성

---

### [WARNING] Modal — DOM 사이드 이펙트 테스트 필요
- **위치**: `src/components/shared/Modal.tsx:13-20`
- **상세**: `document.body.style.overflow` 직접 조작은 JSDOM 환경에서 동작하지만, cleanup 함수가 여러 모달이 동시에 열릴 때 의도치 않게 스크롤을 복원하는 버그가 있습니다.
- **제안**: 중첩 모달 시나리오 테스트 + 카운터 기반 스크롤 잠금으로 개선

---

### [INFO] 순수 컴포넌트들은 테스트 용이 — 즉시 작성 가능
- **위치**: `Button.tsx`, `RankingsTable.tsx`, `PotDisplay.tsx`, `CommunityCards.tsx`, `PlayerList.tsx`, `HelpModal.tsx`
- **상세**: 외부 의존성 없는 순수 프레젠테이셔널 컴포넌트로 `@testing-library/react`로 쉽게 테스트 가능
- **제안**: 스냅샷 테스트 + 주요 props 조합별 렌더링 검증 테스트 우선 작성

---

### [INFO] useGameStore — Zustand 스토어 단위 테스트 미작성
- **위치**: `src/hooks/useGameStore.ts`
- **상세**: `reset()` 동작, 각 setter의 부분 업데이트 검증, 초기 상태 확인 등은 테스트하기 매우 쉬운 케이스입니다.
- **제안**: `zustand/middleware`의 `createWithEqualityFn` 활용 테스트 패턴 적용

---

## 요약

이번 변경에서 추가된 34개의 신규 파일에 **테스트 코드가 전혀 존재하지 않습니다.** 이는 프로젝트 지침(CLAUDE.md)에 명시된 TDD 방법론과 완전히 반하는 상태입니다. 특히 소켓 싱글톤 패턴, 모듈 레벨 가변 상태(`toastId`), `any` 타입 사용 등은 이후 테스트 작성을 구조적으로 어렵게 만드는 설계 결함입니다. 순수 컴포넌트(`Button`, `RankingsTable` 등)부터 시작하여, 포커 테이블 좌석 재정렬 로직과 베팅 컨트롤 입력 검증 같은 복잡한 비즈니스 로직까지 테스트를 즉시 작성해야 합니다. fetch 오류 무음 처리와 AbortController 미사용은 운영 환경에서 사용자 경험 저하로 이어지는 실질적인 위험 요소입니다.

## 위험도

**HIGH**