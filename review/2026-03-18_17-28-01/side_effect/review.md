## 발견사항

### 파일 1: SocketProvider.tsx

- **[WARNING]** 클린업 타이밍 경쟁 조건 (Race Condition)
  - 위치: `return () => { cancelled = true; disconnectSocket(); ... }`
  - 상세: `cancelled = true` 설정 후 즉시 `disconnectSocket()`을 호출하지만, `init()` 내 `await fetch()`가 완료된 후 `cancelled` 체크 전에 클린업이 실행되면 소켓은 연결되지 않는다. 반면 `fetch()` 완료 → `cancelled` 체크 통과 → `getSocket()` 호출 직후 클린업이 실행되면, `disconnectSocket()`은 호출되지만 `s.connect()`는 이후에 실행되어 연결이 끊기지 않은 채 소켓이 살아남는다.
  - 제안: `s.connect()` 호출 후에도 `cancelled` 확인 또는 클린업 함수에서 ref로 소켓 참조를 보관 후 직접 disconnect.

```tsx
// 개선 예시
async function init() {
  await fetch(`${BACKEND_URL}/player/me`, { credentials: 'include' });
  if (cancelled) return;

  const s = getSocket();
  socketRef.current = s;  // ref로 보관
  setSocket(s);
  s.on('connect', () => setIsConnected(true));
  s.on('disconnect', () => setIsConnected(false));
  s.connect();
}

return () => {
  cancelled = true;
  if (socketRef.current) {
    socketRef.current.disconnect();
    socketRef.current = null;
  }
  disconnectSocket();
  setSocket(null);
  setIsConnected(false);
};
```

- **[WARNING]** `fetch` 실패 시 무음 처리
  - 위치: `await fetch(...)` (에러 핸들링 없음)
  - 상세: `/player/me` 요청이 네트워크 오류, CORS, 서버 다운 등으로 실패하면 `init()`이 uncaught promise rejection으로 종료되고, 소켓 연결 로직 전체가 실행되지 않는다. 사용자는 영구적으로 "서버에 연결 중..." 상태에 머문다.
  - 제안: try/catch로 감싸서 실패 시에도 소켓 연결을 시도하거나, 에러 상태를 Context에 노출.

- **[INFO]** `getSocket()`이 싱글톤인 경우 클린업 후 재마운트 시 이벤트 리스너 중복
  - 위치: `s.on('connect', ...)`, `s.on('disconnect', ...)`
  - 상세: `disconnectSocket()`이 소켓을 완전히 파괴하지 않고 참조만 유지하는 싱글톤이라면, 재마운트 시 동일 소켓 인스턴스에 이벤트 리스너가 중복 등록될 수 있다.
  - 제안: 클린업 시 `s.off('connect')`, `s.off('disconnect')` 명시적 제거 확인.

- **[INFO]** 추가된 네트워크 호출이 매 마운트마다 실행
  - 위치: `await fetch(${BACKEND_URL}/player/me, ...)`
  - 상세: React StrictMode(개발 환경)에서는 useEffect가 두 번 실행되므로 `/player/me`가 두 번 호출된다. 프로덕션에서는 문제없으나, 개발 중 중복 쿠키 설정 요청이 발생한다.
  - 제안: 현재 구조상 허용 가능하나, 서버 측 `/player/me`가 멱등(idempotent)함을 확인.

---

### 파일 2: history/history.md

- **[INFO]** 문서 전용 변경, 부작용 없음
  - 히스토리 기록 추가이며 런타임에 영향 없음.

---

## 요약

핵심 변경사항인 `fetch` 선행 후 소켓 연결 방식은 의도한 문제(쿠키 미생성으로 인한 소켓 인증 실패)를 올바르게 해결하는 접근이다. 다만 `fetch` 실패 시 에러 핸들링이 없어 사용자가 연결 화면에 영구적으로 갇히는 부작용이 존재하며, `cancelled` 플래그와 `disconnectSocket()` 사이의 미세한 경쟁 조건으로 인해 클린업이 불완전하게 실행될 가능성이 있다. 이벤트 리스너 중복 등록 가능성은 `getSocket()`의 구현 방식에 따라 달라지므로 해당 모듈 확인이 필요하다.

## 위험도

**MEDIUM** — `fetch` 실패 시 소켓 연결이 전혀 시도되지 않아 사용자 경험에 직접적 영향을 주며, 경쟁 조건은 드물지만 재현 가능한 시나리오에서 소켓 리소스 누수를 유발할 수 있다.