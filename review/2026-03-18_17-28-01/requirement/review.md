### 발견사항

- **[WARNING]** `fetch` 실패 시 소켓 연결이 중단됨
  - 위치: `SocketProvider.tsx:28` — `await fetch(...)` 
  - 상세: `/player/me` 요청이 네트워크 오류, 500 에러 등으로 실패하면 `init()`이 예외를 던지고 소켓 연결이 전혀 이루어지지 않음. try/catch가 없음
  - 제안: try/catch로 감싸고, fetch 실패해도 소켓 연결은 진행하거나 사용자에게 명확한 에러 상태를 노출

- **[WARNING]** fetch 응답 상태 코드 미검증
  - 위치: `SocketProvider.tsx:28`
  - 상세: `await fetch(...)` 결과의 `response.ok`를 확인하지 않음. 서버가 4xx/5xx를 반환해도 쿠키 없이 소켓 연결 시도가 진행될 수 있음
  - 제안: `const res = await fetch(...); if (!res.ok) throw new Error(...)` 또는 실패 상태를 분기 처리

- **[WARNING]** cleanup 경합 조건 — 소켓 이벤트 리스너 누수 가능
  - 위치: `SocketProvider.tsx:44-49` — cleanup 함수
  - 상세: `cancelled = true` 후 `disconnectSocket()`을 호출하지만, `init()`이 이미 `s.on('connect', ...)` 등록을 마친 상태에서 cleanup이 실행되면 소켓은 끊기되 이벤트 리스너는 `s.off()`로 제거되지 않음. `disconnectSocket()`이 내부적으로 모든 리스너를 제거하는지 불명확
  - 제안: `s.off('connect')`, `s.off('disconnect')` 명시적 호출 또는 `disconnectSocket()` 내부에서 처리 보장 확인

- **[INFO]** `cancelled` 플래그가 `init()` 완료 이후 시나리오를 커버하지 못함
  - 위치: `SocketProvider.tsx:23, 35`
  - 상세: `cancelled` 체크는 fetch 완료 후 unmount 여부만 확인. fetch가 완료되고 `s.connect()` 호출 직전 사이에 unmount → cleanup → `disconnectSocket()` 순서로 실행된 후 `s.connect()`가 뒤늦게 실행되는 시나리오에서는 불필요한 연결이 열릴 수 있음
  - 제안: `s.connect()` 이후에도 `cancelled` 상태라면 즉시 `disconnectSocket()` 호출

- **[INFO]** history.md 변경은 요구사항 추적 목적으로 적절하며 별도 이슈 없음

---

### 요약

이번 변경은 쿠키 생성을 보장한 후 소켓을 연결하는 의도로 작성되었으며 핵심 문제를 올바르게 진단했다. 그러나 `/player/me` fetch 실패 시 에러 처리가 전무하여 네트워크 불안정 환경에서 "서버에 연결 중..." 상태가 영구적으로 유지될 위험이 있다. cleanup 경합 조건 처리가 부분적으로 이루어졌으나 이벤트 리스너 정리 및 late connect 시나리오에 대한 보완이 필요하다.

### 위험도

**MEDIUM**