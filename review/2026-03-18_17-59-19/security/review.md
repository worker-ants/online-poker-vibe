## 보안 코드 리뷰

### 발견사항

---

#### 1. **[WARNING]** AI UUID 스푸핑 - 클라이언트 신뢰 문제
- **위치**: `room.gateway.ts` - `processAiTurnsOrNotify()`, `game.service.ts` - `handleAction()`
- **상세**: `handleAction()`에서 `playerUuid`를 클라이언트로부터 수신한 후 그대로 사용합니다. 악의적인 클라이언트가 `playerUuid: "ai-player-1"` 등 AI UUID를 전송하여 AI 플레이어인 척 액션을 수행할 수 있습니다. AI 플레이어 행동은 서버가 전적으로 제어해야 하므로, `handleAction()`에서 해당 UUID가 AI 플레이어인 경우 외부 요청을 거부해야 합니다.
- **제안**: 
```typescript
async handleAction(roomId: string, playerUuid: string, action: PlayerAction) {
  if (isAiPlayer(playerUuid)) {
    throw new Error('AI 플레이어의 액션은 서버에서만 처리됩니다.');
  }
  // ...
}
```

---

#### 2. **[WARNING]** SQL 인젝션 위험 - Raw 쿼리에 하드코딩된 문자열 패턴
- **위치**: `hall-of-fame.service.ts:56`, `:87`
- **상세**: `.andWhere("gp.playerUuid NOT LIKE 'ai-%'")` 쿼리가 리터럴 문자열로 하드코딩되어 있습니다. 현재 이 특정 코드는 파라미터가 없으므로 직접적 SQL 인젝션 위험은 없지만, 패턴 자체가 `AI_UUID_PREFIX` 상수와 이중으로 관리됩니다. `AI_UUID_PREFIX`가 변경될 경우 쿼리가 업데이트되지 않을 수 있으며, 향후 유사 패턴에서 파라미터 바인딩을 누락할 위험이 있습니다.
- **제안**:
```typescript
.andWhere('gp.playerUuid NOT LIKE :aiPrefix', { aiPrefix: `${AI_UUID_PREFIX}%` })
```

---

#### 3. **[WARNING]** AI 플레이어 식별 로직의 우회 가능성
- **위치**: `ai-names.ts` - `isAiPlayer()`, `hall-of-fame.service.ts`
- **상세**: AI 플레이어 식별이 단순 UUID 접두사(`ai-player-`)로만 이루어집니다. 악의적 사용자가 `ai-player-` 접두사로 시작하는 UUID를 가진 실제 계정을 만들 수 있다면, 해당 계정은 랭킹에서 제외됩니다. 또한 쿠키 기반 UUID는 서버에서 직접 생성되지만(`uuidv4()`), `findOrCreate` 흐름에서 외부 UUID 입력이 허용되는지 확인이 필요합니다.
- **제안**: Player 생성 시 `ai-player-` 접두사 사용을 명시적으로 금지하는 검증 추가:
```typescript
if (uuid.startsWith(AI_UUID_PREFIX)) {
  throw new BadRequestException('유효하지 않은 사용자 ID입니다.');
}
```

---

#### 4. **[WARNING]** 인피니트 루프로 인한 서비스 거부(DoS) 가능성
- **위치**: `room.gateway.ts` - `processAiTurnsOrNotify()` (while 루프)
- **상세**: `while (true)` 루프에서 게임 엔진이 특정 조건(예: 버그, 잘못된 상태)으로 인해 `actionRequired`를 계속 반환하거나 AI 액션이 게임을 진행시키지 못하면 무한 루프가 발생하여 서버 프로세스를 블로킹합니다. NestJS WebSocket Gateway는 싱글 이벤트 루프에서 동작하므로 이는 전체 서비스 중단으로 이어집니다.
- **제안**: 최대 반복 횟수 제한 추가:
```typescript
const MAX_AI_TURNS = 100;
let turnCount = 0;
while (turnCount++ < MAX_AI_TURNS) {
  // ...
}
if (turnCount >= MAX_AI_TURNS) {
  console.error(`AI turn limit exceeded for room ${roomId}`);
  // 게임 강제 종료 처리
}
```

---

#### 5. **[INFO]** 쿠키 보안 설정 - 부분적 적용
- **위치**: `player.controller.ts` - `getOrCreateUuid()`
- **상세**: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'` 설정이 올바르게 적용되어 있습니다. 다만 `sameSite: 'lax'` 대신 `'strict'`를 사용하면 CSRF 보호가 더 강화됩니다. 현재 설정은 외부 링크에서의 GET 요청에서 쿠키가 전송될 수 있습니다.
- **제안**: 실제 서드파티 사이트와의 연동이 필요 없다면 `sameSite: 'strict'`로 변경 검토.

---

#### 6. **[INFO]** 게임 결과의 인메모리 데이터 의존 - 무결성 위험
- **위치**: `game.service.ts` - `getGameResult()`
- **상세**: 게임 결과가 DB가 아닌 인메모리 상태(`active.state.players`)에서 직접 생성됩니다. 서버 재시작이나 메모리 손상 시 결과 데이터가 손실되거나 불일치가 발생할 수 있습니다. 특히 `finishGame()`은 트랜잭션으로 DB에 저장하지만, `getGameResult()`는 별도로 인메모리 데이터를 사용합니다.
- **제안**: 게임 종료 후 결과를 DB에서 조회하거나, `finishGame()` 완료 후 캐시된 결과를 반환하도록 리팩토링.

---

#### 7. **[INFO]** 닉네임 입력 검증 - XSS 잠재 위험
- **위치**: `player.controller.ts` - `setNickname()`
- **상세**: `@Body('nickname')` 값에 대한 길이 제한이나 특수문자 필터링이 코드에서 보이지 않습니다. 닉네임이 프론트엔드에서 직접 렌더링될 경우 XSS 벡터가 될 수 있습니다 (React의 경우 기본적으로 이스케이핑하지만, dangerouslySetInnerHTML 등 예외 케이스 존재).
- **제안**: 닉네임 최대 길이 및 허용 문자 집합 제한 추가.

---

### 요약

이번 변경사항은 서버사이드 AI 플레이어 기능 추가로, 핵심 보안 아키텍처는 올바른 방향으로 설계되었습니다. AI 플레이어가 DB에 저장되지 않고 랭킹에서 제외되는 구조는 적절합니다. 그러나 클라이언트가 AI UUID를 사용하여 액션을 스푸핑할 수 있는 취약점이 가장 심각하며, AI 턴 처리의 `while(true)` 루프는 잘못된 게임 상태 시 서버 전체를 블로킹할 수 있습니다. 또한 AI 식별용 접두사가 쿼리와 코드에 이중으로 관리되어 불일치 위험이 있으므로, 상수를 단일 소스로 통합하는 것이 권장됩니다. 쿠키 보안 설정은 전반적으로 양호합니다.

### 위험도

**MEDIUM**