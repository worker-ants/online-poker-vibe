### 발견사항

- **[WARNING]** `GET /player/me` 엔드포인트를 사이드 이펙트 목적(쿠키 생성)으로 사용
  - 위치: `SocketProvider.tsx:29` — `await fetch(\`${BACKEND_URL}/player/me\`, { credentials: 'include' })`
  - 상세: `GET /player/me`는 의미상 현재 플레이어 정보를 조회하는 엔드포인트입니다. 그러나 실제로는 쿠키가 없을 때 새 UUID를 발급하고 Player 엔티티를 생성하는 사이드 이펙트를 가집니다. GET 메서드에 상태 변경 사이드 이펙트가 있는 것은 HTTP 의미론(idempotent, safe) 위반입니다.
  - 제안: 쿠키 발급 전용 엔드포인트(`POST /player/session` 또는 `POST /player/init`)를 분리하거나, 최초 발급은 미들웨어 레벨에서 처리하고 `/player/me`는 순수 조회로 유지

- **[INFO]** fetch 실패 시 소켓 연결을 차단하는 에러 핸들링 부재
  - 위치: `SocketProvider.tsx:28-30`
  - 상세: `fetch` 호출이 실패(네트워크 오류, 5xx 등)하면 `init()` 함수가 reject되지만 `init()`에 `.catch()` 핸들러가 없습니다. 소켓 연결이 영원히 이루어지지 않고 "서버에 연결 중..." 상태가 지속될 수 있습니다.
  - 제안: `try/catch`로 감싸고 실패 시 에러 상태를 Context에 노출하거나 재시도 로직 추가

- **[INFO]** `credentials: 'include'`의 CORS 전제 조건 의존
  - 위치: `SocketProvider.tsx:29`
  - 상세: 쿠키를 포함한 cross-origin 요청이므로 서버 측에서 `Access-Control-Allow-Origin`이 와일드카드(`*`)가 아닌 특정 origin으로 설정되어 있어야 하고 `Access-Control-Allow-Credentials: true`가 필요합니다. 이 전제가 충족되지 않으면 브라우저가 쿠키를 전송하지 않아 쿠키 발급이 무효화됩니다.
  - 제안: API 계약 문서에 CORS 요구사항 명시, 백엔드 CORS 설정과의 일관성 검증 테스트 추가

### 요약

`GET /player/me` 엔드포인트가 쿠키 발급이라는 상태 변경 사이드 이펙트를 포함하고 있어 REST의 안전성(safe) 원칙에 위반됩니다. 이 패턴은 기능적으로는 동작하지만 API 의미론이 불명확해 유지보수 시 혼란을 유발할 수 있습니다. 또한 fetch 실패에 대한 에러 핸들링이 없어 클라이언트가 연결 불가 상태에서 복구 수단 없이 멈출 수 있습니다.

### 위험도
LOW