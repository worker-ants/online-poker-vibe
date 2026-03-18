### 발견사항

- **[INFO]** 내부 모듈 의존성 추가: `@/src/lib/constants`
  - 위치: `SocketProvider.tsx:4`
  - 상세: `BACKEND_URL`을 인라인 하드코딩 대신 상수 모듈에서 가져오는 올바른 패턴. 단, `SocketProvider`가 이제 `constants` 모듈에 의존하므로 해당 상수가 누락되거나 잘못 설정되면 소켓 연결 자체가 불가능해지는 단일 실패 지점이 됨.
  - 제안: `BACKEND_URL`이 빈 문자열이거나 undefined인 경우를 대비한 방어 코드 또는 빌드 시 환경변수 검증 추가 권장.

- **[WARNING]** `fetch` 호출 실패 시 소켓 연결 차단
  - 위치: `SocketProvider.tsx:27-28`
  - 상세: `await fetch(...)` 호출이 네트워크 오류로 throw되면 `init()` 함수가 중단되어 소켓 연결이 아예 이루어지지 않음. `fetch`는 네트워크 실패 시 reject하므로, 백엔드가 일시적으로 다운된 경우 프론트엔드 전체가 "서버에 연결 중..." 상태로 멈출 수 있음. 이는 이번 Turn 4 버그("서버에 연결 중..." 고착)의 잠재적 재발 원인.
  - 제안: `try/catch`로 fetch 실패를 처리하여 쿠키 발급 실패 시에도 소켓 연결을 시도하거나 사용자에게 명확한 에러 메시지를 표시해야 함.

```tsx
async function init() {
  try {
    await fetch(`${BACKEND_URL}/player/me`, { credentials: 'include' });
  } catch {
    // 쿠키 발급 실패해도 소켓 연결 시도 (또는 에러 상태 표시)
  }
  if (cancelled) return;
  // ...
}
```

- **[INFO]** 새로운 외부 패키지 없음
  - 위치: 전체 diff
  - 상세: 이번 변경에서 `package.json` 수정 없이 기존 `fetch` Web API와 내부 상수만 사용. 번들 크기, 라이선스, 취약점 영향 없음.

- **[INFO]** `cancelled` 플래그 패턴의 의존성 안전성
  - 위치: `SocketProvider.tsx:23-45`
  - 상세: React StrictMode의 이중 실행(mount→unmount→mount)에서 첫 번째 `init()`의 fetch가 완료되기 전에 cleanup이 호출될 수 있음. `cancelled` 플래그가 이를 올바르게 차단하나, `disconnectSocket()`은 fetch 진행 중에도 즉시 호출됨. 소켓 라이브러리 내부 상태와 충돌 가능성 여부는 `socket.ts` 구현에 따라 다름.

---

### 요약

이번 변경은 새로운 외부 의존성을 추가하지 않았으며 내부 모듈(`constants`) 재사용은 적절한 패턴이다. 그러나 `fetch` 호출을 소켓 연결의 전제 조건으로 두는 구조상, fetch 실패(네트워크 오류, 백엔드 다운 등)가 소켓 연결 전체를 차단하는 단일 실패 지점이 생겼다. 이번 Turn 4 버그의 근본 원인이 이 패턴에 있었던 만큼, fetch 오류 처리를 추가하지 않으면 동일한 증상이 재발할 수 있다. 취약점·라이선스·버전 충돌 이슈는 없음.

### 위험도

**MEDIUM**