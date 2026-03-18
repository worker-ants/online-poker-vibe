## 아키텍처 리뷰 결과

### 발견사항

- **[WARNING]** `SocketProvider`가 플레이어 초기화 책임을 겸임
  - 위치: `SocketProvider.tsx:29` — `await fetch(BACKEND_URL/player/me, ...)`
  - 상세: `SocketProvider`는 소켓 연결 수명주기 관리가 단일 책임이어야 하나, 플레이어 UUID 쿠키 초기화(`/player/me` 호출)까지 담당하고 있음. SRP 위반. 플레이어 초기화 로직은 `IdentityProvider`나 별도 훅(`usePlayerInit`)에 위치해야 함.
  - 제안: `IdentityProvider`에서 먼저 `/player/me`를 호출하고 완료 후 `SocketProvider`를 렌더링하거나, 별도 `PlayerInitProvider`를 계층 최상단에 배치하여 초기화 책임을 분리

- **[WARNING]** 암묵적 의존성 순서 (Provider 계층 결합)
  - 위치: `SocketProvider.tsx` 전체 구조
  - 상세: `SocketProvider`가 내부적으로 `/player/me`에 의존하므로, `SocketProvider`가 `IdentityProvider`보다 먼저 마운트되면 안 된다는 암묵적 순서 제약이 생김. 이 제약이 코드 외부(layout.tsx의 Provider 중첩 순서)에 숨겨져 있어 유지보수 시 파악이 어려움.
  - 제안: Provider 간 의존 관계를 명시적으로 표현하거나 (예: `SocketProvider`가 `useIdentity()`의 `isReady` 상태를 조건으로 연결 시작), 의존 관계 없이 동작하도록 분리

- **[INFO]** `cancelled` 플래그를 통한 비동기 경쟁 조건 방어는 적절
  - 위치: `SocketProvider.tsx:24–32`
  - 상세: StrictMode의 이중 마운트나 빠른 언마운트 시 소켓이 중복 생성되는 것을 방어하는 올바른 패턴. 하지만 `/player/me` fetch가 실패하는 경우 에러 핸들링이 없어 소켓 연결이 조용히 실패함.
  - 제안: `init()` 내부에 try/catch 추가하여 fetch 실패 시 에러 상태를 Context에 노출하거나 재시도 로직 적용

- **[INFO]** `BACKEND_URL` 상수를 통한 설정 분리는 적절
  - 위치: `SocketProvider.tsx:4`
  - 상세: 하드코딩 대신 `constants.ts`에서 가져오는 구조로, 환경별 설정 변경에 유연함. 추상화 수준 적절.

---

### 요약

이번 변경의 핵심 의도(소켓 연결 전 UUID 쿠키 보장)는 실용적이며 버그 수정 목적에 부합하나, 아키텍처 관점에서 `SocketProvider`가 플레이어 초기화라는 이질적 책임을 흡수하게 되어 SRP를 위반한다. 현재 Provider 계층에서 `IdentityProvider` → `SocketProvider` 의존 순서가 코드 외부에 암묵적으로 존재하게 되며, 에러 핸들링 부재로 인해 `/player/me` 호출 실패 시 소켓 연결이 조용히 중단되는 무결성 문제도 잠재한다. 소규모 프로젝트에서 즉각적인 동작 복구를 위한 타협으로는 수용 가능하나, 향후 `SocketProvider`의 재사용성과 테스트 용이성을 위해 초기화 책임을 분리하는 리팩토링이 권장된다.

### 위험도

**LOW**