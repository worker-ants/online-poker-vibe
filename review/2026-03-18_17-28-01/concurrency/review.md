### 발견사항

- **[WARNING]** `cancelled` 플래그와 `disconnectSocket()` 간 경쟁 조건
  - 위치: `SocketProvider.tsx`, cleanup 함수 (return 블록)
  - 상세: cleanup이 `cancelled = true` 설정 후 즉시 `disconnectSocket()`을 호출하지만, `init()`의 `await fetch(...)` 이후 `if (cancelled) return` 체크 전에 `getSocket()`이 새 소켓 인스턴스를 반환할 수 있음. cleanup이 먼저 `disconnectSocket()`을 호출해 기존 소켓을 해제한 뒤, `init()`이 `cancelled` 체크를 통과해 또 다른 소켓을 생성·연결하는 시나리오가 가능 (StrictMode의 이중 마운트에서 재현 가능).
  - 제안: `getSocket()` 반환값을 지역 변수에 저장하고, cleanup에서 해당 인스턴스를 직접 해제하는 방식으로 변경. 또는 `disconnectSocket()`을 `cancelled` 체크 이후로 이동하는 방식 검토.

- **[WARNING]** fetch 실패 시 소켓 연결 시도 생략
  - 위치: `init()` 함수 내 `await fetch(...)` 라인
  - 상세: `fetch`가 네트워크 오류 등으로 throw할 경우 `init()`이 uncaught rejection으로 종료되며, 소켓 연결 자체가 이루어지지 않음. `cancelled` 체크도 실행되지 않아 cleanup과의 상태 정합성도 보장되지 않음.
  - 제안: try/catch로 fetch 오류를 처리하고, 실패 시에도 적절한 상태(`isConnected: false` 유지)를 보장하도록 처리.

- **[INFO]** `setSocket(s)` 이후 이벤트 리스너 등록 순서
  - 위치: `init()` 내 `setSocket(s)` → `s.on(...)` 순서
  - 상세: `setSocket(s)`로 소켓이 Context에 노출된 직후 자식 컴포넌트가 해당 소켓을 사용할 수 있지만, 이 시점에는 아직 `connect`/`disconnect` 이벤트 리스너가 등록되지 않아 `isConnected` 상태가 `false`인 채로 소켓이 공개됨. 실질적 문제보다는 상태 불일치 순간이 존재.
  - 제안: 이벤트 리스너 등록 → `s.connect()` → `setSocket(s)` 순서로 변경하면 소켓이 Context에 노출되기 전에 리스너가 준비됨.

---

### 요약

변경된 코드는 React의 `useEffect` cleanup 패턴을 `cancelled` 플래그로 올바르게 처리하려 했으나, fetch 비동기 완료 시점과 cleanup 실행 시점이 겹칠 경우 소켓이 이중으로 생성·연결되거나 해제된 소켓에 리스너가 등록될 수 있는 경쟁 조건이 잠재한다. 또한 fetch 예외 처리 부재로 인해 소켓 연결 자체가 무음 실패할 수 있으며, 이는 "서버에 연결 중..." 화면에서 멈추는 증상과 직결된다. 전반적으로 단일 스레드 이벤트 루프 기반임에도 비동기 타이밍 경쟁이 존재하므로 보완이 필요하다.

### 위험도
**MEDIUM**