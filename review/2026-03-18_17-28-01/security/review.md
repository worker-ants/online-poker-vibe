## 보안 코드 리뷰 결과

### 발견사항

---

- **[WARNING]** `BACKEND_URL` 상수를 통한 fetch 호출 시 오류 처리 부재
  - 위치: `SocketProvider.tsx`, `init()` 함수 내 `await fetch(...)` 라인
  - 상세: `/player/me` fetch 실패(네트워크 오류, 5xx 응답) 시 예외가 catch되지 않아 소켓 연결이 중단되나, 사용자에게 오류가 노출되지 않고 조용히 실패함. 또한 응답 상태 코드 검증이 없어 실패 응답에도 소켓 연결을 시도할 수 있음
  - 제안:
    ```tsx
    const res = await fetch(`${BACKEND_URL}/player/me`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Player init failed: ${res.status}`);
    ```
    try/catch로 감싸고 오류 상태를 Context에 노출할 것

---

- **[WARNING]** `credentials: 'include'` 사용 시 CORS 정책 의존도 높음
  - 위치: `SocketProvider.tsx`, fetch 호출부
  - 상세: 쿠키를 포함한 cross-origin 요청이므로 백엔드의 `Access-Control-Allow-Origin`이 와일드카드(`*`)가 아닌 명시적 출처여야 하며, `Access-Control-Allow-Credentials: true` 설정이 필수임. 프런트엔드 단에서는 검증 불가하나, 설정 오류 시 쿠키가 전송되지 않아 인증이 우회될 수 있음
  - 제안: 백엔드 CORS 설정에서 `origin`이 명시적 화이트리스트인지, `credentials: true`가 설정되어 있는지 확인 필요

---

- **[INFO]** `BACKEND_URL` 환경 변수 노출 경로 확인 필요
  - 위치: `constants.ts` (import 출처)
  - 상세: `BACKEND_URL`이 `NEXT_PUBLIC_` 접두사를 가진 환경 변수로 빌드 시 번들에 포함되는 것은 클라이언트 URL이므로 정상이나, `.env` 파일이 `.gitignore`에 포함되어 있는지, 내부 서비스 URL이나 민감한 포트 정보가 노출되지 않는지 확인 필요
  - 제안: 프로덕션 배포 시 역방향 프록시(Nginx 등)를 통해 내부 포트를 숨길 것

---

- **[INFO]** cleanup 함수의 경쟁 조건(race condition) 잔존 가능성
  - 위치: `SocketProvider.tsx`, `cancelled` 플래그 및 cleanup 함수
  - 상세: `cancelled = true` 이후 `disconnectSocket()`이 호출되나, `init()` 내 fetch가 완료된 직후 `cancelled` 체크 전 짧은 구간에서 `getSocket()`이 호출될 수 있음. 현재 구현에서는 `if (cancelled) return`으로 충분히 방어되고 있으나, 향후 `init()` 내 추가 비동기 작업 시 각 await 후 체크가 필요함
  - 제안: 현재 구조 유지 시 문제없으나, 비동기 단계가 늘어날 경우 각 `await` 이후 `if (cancelled) return` 패턴을 반복 적용할 것

---

### 요약

이번 변경사항은 소켓 연결 전 쿠키 초기화를 보장하는 목적으로, 전반적인 보안 설계 방향은 올바름. `credentials: 'include'`를 통한 쿠키 기반 인증도 적절한 패턴임. 다만 fetch 실패에 대한 오류 처리가 부재하여 인증 쿠키 없이 소켓 연결이 시도될 수 있는 경로가 존재하며, 이는 서버측 WebSocket 핸드셰이크 인증 로직(WS Guard)이 1차 방어선이 되어야 함. 하드코딩된 시크릿, 인젝션, 민감 정보 노출 등의 Critical/High 취약점은 발견되지 않음.

### 위험도

**LOW**