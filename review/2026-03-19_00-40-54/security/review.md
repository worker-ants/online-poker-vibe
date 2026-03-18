## 발견사항

---

### 1. **[CRITICAL]** 암호학적으로 안전하지 않은 난수 생성 (카드 셔플)
- **위치**: `five-card-draw.engine.ts` `handleDraw()` 내 Fisher-Yates 셔플, 그리고 참조되는 `deck.js`
- **상세**: `Math.random()`은 암호학적으로 안전한 난수 생성기(CSPRNG)가 아닙니다. V8 엔진의 `Math.random()` 시드는 예측 가능하여 카드 시퀀스를 통계적으로 추론하거나 브라우저 타이밍 공격으로 역산할 수 있습니다. 포커 게임에서 이는 상대방의 패를 예측하는 치팅으로 직결됩니다.
- **제안**: Node.js의 `crypto.randomInt()` 또는 `crypto.getRandomValues()`(Web Crypto API)를 사용하세요.
  ```typescript
  import { randomInt } from 'crypto';
  const j = randomInt(0, i + 1);
  ```

---

### 2. **[HIGH]** 쿠키 UUID 미검증 — AI 플레이어 신원 위장 가능
- **위치**: `player.controller.ts` `getOrCreateUuid()`, `game.service.ts` `handleAction()`
- **상세**: 클라이언트가 `player_uuid` 쿠키 값을 `AI_UUID_PREFIX`로 시작하는 임의 문자열로 설정할 수 있습니다. `isAiPlayer()` 검사는 UUID 접두사 기반으로 동작하므로, 악의적인 사용자가 AI 플레이어로 위장할 가능성이 있습니다. 반대로 `fromAiLoop = false`이면서 AI 접두사 UUID를 가진 쿠키를 보내면 `handleAction`에서 차단되지만, `findOrCreate`는 해당 값을 그대로 DB에 저장합니다. UUID 형식 검증이 없으므로 임의의 문자열이 PK로 저장됩니다.
- **제안**: 쿠키에서 읽은 UUID는 반드시 형식 검증을 수행하세요.
  ```typescript
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid || !UUID_REGEX.test(uuid)) {
    uuid = uuidv4();
  }
  ```

---

### 3. **[HIGH]** RoomSettings 깊은 검증 누락 — 게임 규칙 임의 조작
- **위치**: `create-room.dto.ts`, `room.service.ts` `createRoom()`
- **상세**: `settings` 필드는 `@IsObject()`만 검증하며, 내부 값에 대한 범위 제한이 없습니다. 악의적인 사용자가 다음과 같은 값을 전송할 수 있습니다.
  ```json
  { "settings": { "startingChips": 999999999, "bigBlind": 0, "smallBlind": -1 } }
  ```
  이 값들은 기본값에 `...spread`되어 그대로 게임에 적용됩니다. 음수 블라인드는 칩 계산 로직에 버그를 유발합니다.
- **제안**: `settings`에 `@ValidateNested()` + `@Type()`과 함께 별도 DTO를 정의하고 각 필드에 `@Min()`, `@Max()` 제약을 추가하세요.
  ```typescript
  export class RoomSettingsDto {
    @IsInt() @Min(100) @Max(1000000) startingChips: number;
    @IsInt() @Min(1) @Max(10000) smallBlind: number;
    @IsInt() @Min(2) @Max(20000) bigBlind: number;
  }
  ```

---

### 4. **[HIGH]** WebSocket 액션의 플레이어 신원 검증 불확실
- **위치**: `game.service.ts` `handleAction()` — `room.gateway.ts` 의존
- **상세**: `handleAction(roomId, playerUuid, action)`에서 `playerUuid`가 호출자(게이트웨이)로부터 전달됩니다. 게이트웨이가 클라이언트 메시지 페이로드에서 `playerUuid`를 받아 그대로 전달한다면, 클라이언트 A가 클라이언트 B의 UUID를 메시지에 포함시켜 B 대신 행동할 수 있습니다. 쿠키에서 추출한 UUID만 신뢰해야 합니다.
- **제안**: 게이트웨이에서 반드시 인증된 쿠키의 UUID를 사용하고, 클라이언트가 전달한 `playerUuid`를 신뢰하지 마세요.
  ```typescript
  // gateway에서
  const playerUuid = client.data.playerUuid; // 쿠키 기반 인증에서 설정된 값
  await this.gameService.handleAction(roomId, playerUuid, action);
  ```

---

### 5. **[MEDIUM]** Rate Limiting 부재 — DoS 및 브루트포스 위험
- **위치**: `main.ts`, `player.controller.ts`, `room.gateway.ts`
- **상세**: 닉네임 설정(`/player/nickname`), 방 생성(`/rooms`), WebSocket 연결 및 게임 액션에 대한 요청 빈도 제한이 없습니다. 공격자가 대량 요청으로 DB를 포화시키거나 닉네임 중복 확인을 통해 유효한 닉네임을 열거할 수 있습니다.
- **제안**: `@nestjs/throttler` 패키지로 Rate Limiting을 적용하세요.
  ```typescript
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])
  ```

---

### 6. **[MEDIUM]** TOCTOU 경쟁 조건 — 닉네임 중복 확인
- **위치**: `player.service.ts` `setNickname()`
- **상세**: `findOne({ where: { nickname } })` 후 `save()` 사이에 다른 요청이 동일 닉네임으로 저장을 완료할 수 있습니다. DB `UNIQUE` 제약과 catch 블록이 이를 부분적으로 완화하지만, 오류 핸들링이 `SQLITE_CONSTRAINT`와 `QueryFailedError`에만 의존하여 다른 DB 드라이버에서는 통하지 않을 수 있습니다.
- **제안**: DB 제약 기반 처리는 유지하되, 오류 타입 식별을 더 견고하게 하세요. `Upsert` 패턴도 고려할 수 있습니다.

---

### 7. **[MEDIUM]** CORS `origin` 미설정 시 localhost 폴백
- **위치**: `main.ts`
- **상세**: `FRONTEND_URL` 환경변수가 설정되지 않으면 `http://localhost:3001`이 허용됩니다. `credentials: true`와 함께 사용 시 쿠키 포함 요청이 허용되는 출처가 환경변수 누락으로 인해 잘못 설정될 수 있습니다. 운영 환경 배포 체크리스트에서 누락되기 쉽습니다.
- **제안**: 환경변수 미설정 시 명시적으로 실패하거나 엄격한 기본값을 사용하세요.

---

### 8. **[INFO]** `hall-of-fame` 대용량 페이지 오프셋으로 DB 부하 가능
- **위치**: `hall-of-fame.controller.ts`
- **상세**: `page` 값이 검증되지 않아 매우 큰 `offset`(page × limit)이 발생할 수 있습니다. SQLite에서 대용량 오프셋 쿼리는 성능 저하를 유발합니다.
- **제안**: `page`에도 `@Max()` 제한을 추가하거나 커서 기반 페이지네이션을 사용하세요.

---

## 요약

전체적으로 TypeORM ORM을 사용하여 SQL 인젝션은 잘 방어되어 있으며, 닉네임 입력 검증, httpOnly 쿠키 사용, ValidationPipe 적용 등 기본적인 보안 관행을 따르고 있습니다. 그러나 **포커 게임의 핵심인 카드 셔플에 CSPRNG가 사용되지 않는 점**이 가장 심각한 취약점으로, 카드 시퀀스 예측을 통한 치팅이 이론적으로 가능합니다. 또한 쿠키 UUID 미검증으로 인한 AI 플레이어 위장 가능성, `RoomSettings` 입력값의 깊은 검증 부재, WebSocket 액션에서의 플레이어 신원 검증 의존성이 주요 위험 요소입니다.

## 위험도

**HIGH**