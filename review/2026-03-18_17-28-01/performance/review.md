## 성능 리뷰: SocketProvider.tsx

### 발견사항

- **[WARNING]** 앱 초기화마다 불필요한 HTTP 요청 발생
  - 위치: `init()` 함수, `await fetch(${BACKEND_URL}/player/me, ...)`
  - 상세: `SocketProvider`가 마운트될 때마다 `/player/me`를 무조건 호출함. 쿠키가 이미 존재하는 경우에도 매번 네트워크 왕복이 발생하여 소켓 연결이 그만큼 지연됨. 쿠키는 브라우저에 이미 있으므로 확인 후 조건부 호출이 가능함.
  - 제안: 쿠키 존재 여부를 먼저 확인하고(`document.cookie`에서 `player_uuid` 파싱), 없을 때만 fetch 호출.

- **[WARNING]** fetch 실패 시 소켓 연결 자체가 무한 블로킹됨
  - 위치: `await fetch(...)` — 에러 핸들링 없음
  - 상세: 네트워크 오류, 서버 다운, CORS 오류 등으로 fetch가 reject되면 `init()`이 예외를 던지고 소켓 연결이 영원히 이루어지지 않음. 현재 "서버에 연결 중..." 상태로 멈추는 버그의 직접 원인일 수 있음.
  - 제안: `try/catch`로 감싸고, 실패 시에도 소켓 연결을 시도하거나 에러 상태를 노출할 것.

```tsx
async function init() {
  try {
    await fetch(`${BACKEND_URL}/player/me`, { credentials: 'include' });
  } catch {
    // 쿠키 사전 생성 실패 시에도 소켓 연결 시도
  }
  if (cancelled) return;
  // ...
}
```

- **[INFO]** `cancelled` 플래그 확인 후 이미 시작된 소켓이 정리되지 않음
  - 위치: `if (cancelled) return;` 이후 소켓 생성 로직
  - 상세: `cancelled` 체크는 `getSocket()` 호출 전에만 있음. `setSocket(s)` 후 cleanup이 실행되는 race condition은 이미 `return () => { disconnectSocket() }` 으로 처리되나, `getSocket()`이 싱글톤 방식이면 재진입 시 이전 리스너가 중복 등록될 가능성 있음.
  - 제안: `getSocket()` 구현에서 리스너 중복 등록 방지(`s.off` 후 `s.on`) 또는 `SocketProvider` 내에서 cleanup 시 리스너도 제거.

```tsx
s.off('connect').on('connect', () => setIsConnected(true));
s.off('disconnect').on('disconnect', () => setIsConnected(false));
```

- **[INFO]** `history.md` 파일 — 성능 관련 변경 없음
  - 위치: `history/history.md`
  - 상세: 단순 히스토리 기록 문서로 성능과 무관함.

---

### 요약

이번 변경의 핵심 성능 문제는 **앱 마운트 시 항상 발생하는 동기적 HTTP 선행 요청**이다. 쿠키가 이미 존재하는 경우에도 매번 `/player/me`를 기다린 뒤 소켓을 연결하므로 체감 연결 지연이 증가한다. 더 심각한 것은 에러 핸들링이 없어 이 fetch 하나가 실패하면 소켓 연결 자체가 완전히 차단된다는 점으로, 이는 "서버에 연결 중..." 무한 대기 증상의 직접 원인으로 의심된다. `cancelled` 플래그를 통한 race condition 방어 로직 자체는 적절하나, 리스너 중복 등록 가능성은 별도로 검토가 필요하다.

### 위험도

**HIGH** — fetch 실패 시 전체 소켓 연결이 블로킹되는 구조적 문제가 있음.