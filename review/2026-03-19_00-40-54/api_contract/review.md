### 발견사항

---

- **[WARNING]** `POST /player/nickname` — DTO 없이 직접 `@Body('nickname')` 바인딩
  - 위치: `player.controller.ts:36` — `@Body('nickname') nickname: string`
  - 상세: 글로벌 `ValidationPipe`(whitelist: true, transform: true)는 DTO 클래스에서 동작합니다. 단일 필드 바인딩 방식에서는 화이트리스트·타입 변환이 적용되지 않으며, 유효성 검증이 서비스 계층에서만 이루어져 일관된 422/400 응답 구조가 보장되지 않습니다.
  - 제안: `NicknameDto` 클래스를 만들고 `@IsString()`, `@Length(2, 20)` 데코레이터로 컨트롤러 레벨에서 검증하세요.

---

- **[WARNING]** 응답 형식 비일관성 — 엔드포인트마다 다른 응답 구조
  - 위치:
    - `GET /rooms` → 배열 직접 반환
    - `POST /rooms` → `{ success: true, roomId }`
    - `GET /hall-of-fame` → `{ data, pagination }`
    - `GET /hall-of-fame/:uuid/history` → `{ nickname, games }`
    - `GET /player/me` → `{ uuid, nickname }`
  - 상세: 클라이언트가 응답 구조를 예측할 수 없습니다. 페이지네이션이 있는 응답은 `{ data, pagination }`을 쓰고, 단건 조회는 객체를 직접, 목록은 배열을 직접 반환하는 등 일관된 패턴이 없습니다.
  - 제안: `{ data: T, meta?: PaginationMeta }` 형태의 표준 응답 래퍼를 도입하거나, 최소한 목록/단건/액션 응답 패턴을 문서화하고 일관되게 적용하세요.

---

- **[WARNING]** API 버전 관리 부재
  - 위치: `player.controller.ts`, `room.controller.ts`, `hall-of-fame.controller.ts` — 모든 경로
  - 상세: `/player/me`, `/rooms`, `/hall-of-fame` 등 모든 엔드포인트에 버전이 없습니다. 향후 breaking change 발생 시 기존 클라이언트를 보호할 방법이 없습니다.
  - 제안: NestJS의 `@Controller({ version: '1' })` 또는 경로 접두어 `/api/v1/`을 적용하세요.

---

- **[WARNING]** `getWaitingRooms()` 반환 타입 `any[]`
  - 위치: `room.service.ts` — `async getWaitingRooms(): Promise<any[]>`
  - 상세: API 응답 필드가 타입으로 보장되지 않아 실수로 민감 정보가 포함되거나 필드가 누락될 수 있습니다.
  - 제안: `WaitingRoomDto` 인터페이스를 정의하고 `Promise<WaitingRoomDto[]>`로 반환 타입을 명시하세요.

---

- **[WARNING]** WebSocket 이벤트 계약 — `room.gateway.ts` 미포함
  - 위치: `room.gateway.ts` (diff 생략됨)
  - 상세: 게임의 핵심 실시간 API인 WebSocket 게이트웨이가 리뷰 범위에서 누락되었습니다. `handleAction`, `startNextHand` 등의 이벤트 이름·페이로드 구조·에러 응답 포맷이 검증되지 않았습니다.
  - 제안: WebSocket 이벤트 목록과 페이로드 스키마를 별도 문서화하고 리뷰에 포함시키세요.

---

- **[INFO]** 에러 응답 형식 — HTTP 예외는 NestJS 기본 형식 `{ statusCode, message, error }` 사용
  - 위치: `room.service.ts`, `player.service.ts` — `BadRequestException`, `UnauthorizedException`
  - 상세: 현재 NestJS 기본 에러 형식을 그대로 사용합니다. 클라이언트와 이 형식으로 암묵적 계약이 맺어진 상태이므로, 향후 글로벌 예외 필터를 추가할 때 깨지지 않도록 주의해야 합니다.
  - 제안: 글로벌 `ExceptionFilter`를 명시적으로 정의해 에러 형식을 코드로 고정하세요.

---

- **[INFO]** `GET /hall-of-fame` — `limit` 쿼리 파라미터 상한선 100 하드코딩
  - 위치: `hall-of-fame.controller.ts:12` — `Math.min(100, ...)`
  - 상세: 클라이언트가 100 이상을 요청할 때 자동으로 100으로 내려가지만 이에 대한 응답 헤더나 메시지가 없어 클라이언트가 실제로 잘렸는지 알 수 없습니다.
  - 제안: 응답 `pagination.limit`에 실제 적용된 값을 반환하고 있으므로 클라이언트에서 이를 확인하도록 API 문서에 명시하세요 (현재 구현은 이미 실제 값을 반환하므로 문서화만 필요).

---

- **[INFO]** 인증 — `POST /player/nickname`에 기존 플레이어 여부 검증 없음
  - 위치: `player.controller.ts:36–43`
  - 상세: UUID가 쿠키에 없으면 새 UUID를 자동 생성합니다. 즉, 쿠키 없이 `POST /player/nickname`을 호출하면 임의 UUID로 닉네임이 설정됩니다. 이는 의도된 동작이지만, 클라이언트가 `GET /player/me` 없이 바로 닉네임을 설정하는 흐름에서 UUID가 응답에 포함되지 않으면 클라이언트가 자신의 UUID를 알 수 없습니다.
  - 제안: 현재 응답에 `uuid`가 포함되어 있으므로 문제없지만, 이 흐름을 API 문서에 명시하세요.

---

### 요약

이 코드베이스의 HTTP REST API는 플레이어 관리, 방 관리, 명예의 전당 3가지 영역으로 구성되어 있으며, 기본적인 CRUD 패턴은 잘 구현되어 있습니다. 그러나 API 계약 관점에서 세 가지 주요 위험 요소가 있습니다: 첫째로 API 버전 관리가 전혀 없어 향후 스펙 변경 시 기존 클라이언트와의 하위 호환성을 보장할 수단이 없고, 둘째로 엔드포인트마다 응답 구조가 다르게 설계되어 클라이언트의 타입 안전성과 예측 가능성이 낮으며, 셋째로 `POST /player/nickname`의 DTO 부재로 컨트롤러 레벨의 입력 검증이 누락되어 있습니다. 게임 핵심 로직을 담당하는 WebSocket API(`room.gateway.ts`)가 리뷰에 포함되지 않은 것도 주요 갭입니다.

### 위험도
**MEDIUM**