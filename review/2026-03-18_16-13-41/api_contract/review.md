### 발견사항

- **[CRITICAL]** `room.controller.ts`의 에러 응답 형식 불일치
  - 위치: `room.controller.ts:18-21`
  - 상세: 인증 실패 시 `{ success: false, error: '...' }` 를 200 OK로 반환하지만, `RoomService`에서는 `BadRequestException`을 throw하여 NestJS 기본 형식(`{ statusCode, message, error }`)으로 응답함. 같은 컨트롤러에서 두 가지 에러 형식이 혼재하여 클라이언트가 일관된 에러 처리를 할 수 없음
  - 제안: `throw new UnauthorizedException('인증이 필요합니다.')` 로 변경하거나, 모든 에러 응답을 `{ success, error }` 형식으로 통일하는 Global Exception Filter 도입

- **[WARNING]** `POST /player/nickname`에 DTO 없이 raw Body 추출
  - 위치: `player.controller.ts:37`
  - 상세: `@Body('nickname') nickname: string` 은 ValidationPipe가 적용되지 않아 `undefined`, 빈 문자열 등이 서비스 레이어까지 그대로 전달됨. 서비스에서 검증하지만 API 계약상 클라이언트에게 400 응답 보장이 불명확함
  - 제안: `SetNicknameDto` 클래스를 만들고 `@IsString() @Length(2, 20)` 등 class-validator 데코레이터 적용

- **[WARNING]** `POST /player/nickname` HTTP 메서드 부적절
  - 위치: `player.controller.ts:31`
  - 상세: 닉네임 설정/수정은 idempotent한 업데이트 작업이므로 `POST`보다 `PATCH /player/me` 또는 `PUT /player/nickname`이 RESTful 설계에 부합함
  - 제안: `PATCH /player/me` 로 변경하고 바디에 `{ nickname }` 포함

- **[WARNING]** `PlayerController`에서 `@Res()` 직접 사용으로 NestJS 인터셉터 우회
  - 위치: `player.controller.ts:13, 32`
  - 상세: `@Res()` 를 사용하면 NestJS의 응답 인터셉터, ClassSerializerInterceptor 등이 동작하지 않음. 향후 전역 응답 변환 로직 적용이 불가능해짐
  - 제안: `@Res({ passthrough: true })` 사용 또는 쿠키 설정은 `@nestjs/common`의 `@Header()` 대신 커스텀 인터셉터로 분리

- **[WARNING]** `GET /hall-of-fame`, `GET /hall-of-fame/:playerUuid/history`에 인증/인가 없음
  - 위치: `hall-of-fame.controller.ts`
  - 상세: 명세(WS_EVENTS에 따르면 닉네임 설정이 전제)상 플레이어 식별이 필요한 서비스임에도 불구하고 누구나 호출 가능. `playerUuid` path parameter를 임의로 조작하여 다른 플레이어 게임 기록 조회 가능
  - 제안: `NicknameRequiredGuard` 적용 또는 쿠키 기반 자신의 기록만 조회 가능하도록 제한

- **[WARNING]** URL 네이밍 불일치
  - 위치: `player.controller.ts`, `room.controller.ts`, `hall-of-fame.controller.ts`
  - 상세: `/player` (단수), `/rooms` (복수), `/hall-of-fame` (케밥케이스) 로 일관성이 없음
  - 제안: 복수형 통일 → `/players/me`, `/players/me/nickname`, `/rooms`, `/hall-of-fame`

- **[WARNING]** `POST /rooms`가 201 Created 대신 200 OK 반환
  - 위치: `room.controller.ts:16-23`
  - 상세: NestJS 기본 POST 응답은 201이지만 `@HttpCode(201)` 명시가 없어도 동작하지만, 반환 객체에 생성된 리소스의 URL(`Location` 헤더)이 없음
  - 제안: `@HttpCode(201)` 명시 및 `Location: /rooms/{roomId}` 헤더 추가

- **[INFO]** API 버전 관리 없음
  - 위치: 전체 컨트롤러
  - 상세: `/v1/` prefix나 헤더 기반 버전 관리가 없어 향후 breaking change 시 클라이언트 마이그레이션 경로 부재
  - 제안: NestJS의 `enableVersioning()` 도입 또는 `/api/v1/` prefix 설정

- **[INFO]** `GET /rooms` 페이지네이션 없음
  - 위치: `room.service.ts:82-95`
  - 상세: 방 목록이 무제한으로 반환됨. Hall of Fame과 달리 페이지네이션이 없어 방이 많아질 경우 응답 크기 문제 발생 가능
  - 제안: `page`, `limit` 쿼리 파라미터 추가

---

### 요약

이번 변경은 온라인 포커 서비스의 초기 백엔드 API를 전면적으로 구성한 것으로, WebSocket 기반 게임 로직과 REST API가 함께 설계되었습니다. 가장 심각한 문제는 `RoomController`에서 인증 실패 시 200 OK + `{ success: false }` 형식을 반환하는 반면 나머지 에러는 NestJS HttpException 형식으로 응답하는 불일치로, 클라이언트가 일관된 에러 처리를 구현할 수 없습니다. 또한 `PlayerController`의 닉네임 설정 엔드포인트는 DTO 없이 raw body 추출을 하여 ValidationPipe가 작동하지 않고, `@Res()` 직접 사용으로 NestJS 인터셉터 체인이 우회됩니다. Hall of Fame 엔드포인트는 누구나 접근 가능하여 다른 플레이어의 게임 기록 조회가 무제한으로 허용됩니다. REST 설계 원칙(HTTP 메서드, 복수형 URL, 201 응답코드)과 API 버전 관리도 개선이 필요합니다.

### 위험도
**HIGH**