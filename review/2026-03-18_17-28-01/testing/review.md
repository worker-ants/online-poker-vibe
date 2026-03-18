### 발견사항

- **[CRITICAL]** `init()` 함수의 fetch 실패 케이스에 대한 테스트 없음
  - 위치: `SocketProvider.tsx:28` — `await fetch(...)` 호출부
  - 상세: fetch가 실패(네트워크 오류, 5xx, CORS 등)할 경우 `getSocket()`이 호출되지 않아 소켓 연결이 영구적으로 누락됨. 이 경로에 대한 테스트가 없고, 코드 자체에도 try/catch가 없음
  - 제안: fetch 실패 시 재시도하거나 에러 상태를 context에 노출하는 로직 추가 후 해당 경로 테스트 작성

- **[CRITICAL]** `cancelled` 플래그의 race condition 시나리오 테스트 없음
  - 위치: `SocketProvider.tsx:25~43`
  - 상세: `cancelled = true` 설정 후 fetch가 완료되는 타이밍(cleanup → fetch resolve 순서)에 대한 테스트가 없음. `disconnectSocket()` 이후 `s.connect()`가 호출되는 시나리오가 실제로 방지되는지 검증 불가
  - 제안: fake timers + mock fetch를 활용하여 cleanup이 fetch 완료 전 호출되는 시나리오를 명시적으로 테스트

- **[WARNING]** 기존 `SocketProvider` 테스트가 async `init()` 패턴에 맞게 업데이트되었는지 불명확
  - 위치: `frontend/src/providers/SocketProvider.test.tsx` (존재 여부 미확인)
  - 상세: 동기 초기화에서 비동기 초기화로 변경되었으므로, 기존 테스트가 `waitFor` 없이 `socket` 또는 `isConnected`를 즉시 assert했다면 false negative 발생 가능
  - 제안: 모든 소켓 상태 assert를 `await waitFor(() => ...)` 패턴으로 래핑

- **[WARNING]** `BACKEND_URL` 상수가 테스트 환경에서 올바른 값을 가지는지 검증 없음
  - 위치: `SocketProvider.tsx:28` — `${BACKEND_URL}/player/me`
  - 상세: 테스트 환경에서 `BACKEND_URL`이 `undefined`이거나 프로덕션 URL을 가리킬 경우, fetch mock 없이는 실제 네트워크 호출이 발생하거나 URL이 `undefined/player/me`로 조합됨
  - 제안: `constants.ts`에 대한 jest mock 또는 `msw`를 통한 인터셉터 설정 필요

- **[INFO]** 테스트에서 `fetch`를 mock할 때 `credentials: 'include'` 옵션 검증 누락 가능
  - 위치: `SocketProvider.tsx:28`
  - 상세: 쿠키 생성이 이 변경의 핵심 목적이므로, `credentials: 'include'`가 실제로 전달되는지 assert하는 테스트가 있어야 함
  - 제안: `expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/player/me'), { credentials: 'include' })`

---

### 요약

이번 변경은 소켓 연결 전 쿠키 초기화를 보장하기 위한 비동기 패턴 도입으로, 실제 버그 수정에는 적절한 접근이나 테스트 커버리지 관점에서 심각한 공백이 있다. 핵심인 fetch 실패 경로와 race condition(cleanup vs async init) 시나리오가 테스트로 검증되지 않아 향후 유사한 연결 문제가 재발해도 테스트에서 잡히지 않을 가능성이 높다. `credentials: 'include'` 옵션 검증과 비동기 전환에 따른 기존 테스트 호환성 확인이 즉시 필요하다.

### 위험도

**HIGH**