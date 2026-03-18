### 발견사항

- **[CRITICAL]** Next.js 리라이트와 실제 API 호출 불일치
  - 위치: `frontend/next.config.ts` + `frontend/src/lib/constants.ts` + `hall-of-fame/page.tsx`
  - 상세: `next.config.ts`는 `/api/:path*` → `http://localhost:3000/:path*` 리라이트를 설정했지만, 모든 REST 호출은 `BACKEND_URL`(= `http://localhost:3000`)을 직접 사용합니다. 리라이트 경로(`/api/...`)는 실제 코드 어디에서도 사용되지 않아 설정이 무효화됩니다. 프로덕션에서 백엔드가 다른 호스트로 분리될 경우 CORS 정책 위반 및 쿠키 전달 실패로 이어집니다.
  - 제안: `BACKEND_URL`을 `/api`로 변경하거나, 아니면 Next.js 리라이트를 제거하고 백엔드 CORS 설정을 명시적으로 관리하는 방향으로 통일하세요.

- **[WARNING]** HTTP 응답 상태 코드 미검증
  - 위치: `frontend/app/hall-of-fame/page.tsx` L29-35, L45-50
  - 상세: `res.ok` 검사 없이 `res.json()`을 호출합니다. 서버가 4xx/5xx를 반환해도 오류 JSON을 파싱 후 `data.data ?? []`로 빈 배열 처리되어 **에러가 무음으로 삼켜집니다**. 특히 `handlePlayerClick`은 오류 자체를 `// ignore`로 처리합니다.
  - 제안:
    ```ts
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ```
    를 추가하고, 사용자에게 에러 토스트를 표시하세요.

- **[WARNING]** `handleCreate`의 `any` 타입으로 API 계약 약화
  - 위치: `frontend/app/page.tsx` L51
  - 상세: `(data: any)`는 `CreateRoomModal`의 `onCreate` prop 타입(`{ name, variant, mode, maxPlayers, settings }`)과 실제 WebSocket 페이로드(`WS_EVENTS.ROOM_CREATE`) 사이의 계약을 런타임까지 검증하지 않습니다.
  - 제안: `CreateRoomModal`의 `onCreate` prop 타입을 `import`해서 사용하세요.

- **[WARNING]** `BACKEND_URL` 기본값이 localhost 하드코딩
  - 위치: `frontend/src/lib/constants.ts` L27
  - 상세: `process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'`로 폴백이 개발 환경 주소입니다. 환경 변수 미설정 시 프로덕션에서도 localhost로 연결을 시도합니다.
  - 제안: 환경 변수 미설정 시 빌드 단계에서 경고 또는 에러를 발생시키거나, Next.js 리라이트를 통한 상대경로(`/api`) 사용을 권장합니다.

- **[INFO]** WebSocket `room:list` 이벤트 페이로드 스펙 불일치
  - 위치: `frontend/src/hooks/useRoomList.ts` L17
  - 상세: 스펙(`07-websocket-events.md`)에서 `room:list`의 Payload를 "none"으로 정의했으나, 구현에서 `{}` 빈 객체를 전송합니다. 기능상 무해하지만 스펙과 구현이 다릅니다.
  - 제안: 스펙을 `{}` 허용으로 업데이트하거나 `socket.emit(WS_EVENTS.ROOM_LIST, (rooms) => ...)`처럼 페이로드 없이 호출하세요.

- **[INFO]** 에러 응답 구조가 에러 코드 없이 문자열 메시지만 사용
  - 위치: `frontend/src/providers/IdentityProvider.tsx` L51, `frontend/app/page.tsx` 전체
  - 상세: WebSocket acknowledgement의 에러 응답이 `{ success: false, error: string }` 형태로 에러 코드 없이 문자열만 사용합니다. 클라이언트에서 특정 에러 유형(중복 닉네임, 방 만원 등)을 구분하여 처리하기 어렵습니다.
  - 제안: `{ success: false, error: string, code?: string }` 형태로 에러 코드를 추가하세요.

---

### 요약

이번 변경은 신규 프론트엔드 구현으로 기존 API와의 하위 호환성 파괴 이슈는 없습니다. 가장 주요한 문제는 `next.config.ts`의 `/api/:path*` 리라이트 설정이 실제 API 호출 코드에서 전혀 활용되지 않아 **이중 URL 전략**이 충돌하는 구조적 문제입니다. 이는 프로덕션 CORS 이슈로 직결될 수 있습니다. 또한 REST 호출에서 HTTP 상태 코드를 검증하지 않아 서버 에러가 UI에서 빈 상태로 조용히 처리되는 문제도 수정이 필요합니다. WebSocket 이벤트 이름과 응답 구조는 스펙(`07-websocket-events.md`)과 대체로 일치하며 계약은 잘 유지되고 있습니다.

### 위험도
**MEDIUM**