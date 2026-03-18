## 문서화 코드 리뷰

### 발견사항

---

**[WARNING] 환경 변수 문서화 누락**
- 위치: `backend/src/main.ts`, `.gitignore`
- 상세: `FRONTEND_URL`, `PORT`, `NODE_ENV` 환경 변수가 코드에서 사용되고 있으나, `.env.example` 파일이나 README에 이들 변수에 대한 문서가 없음
- 제안: `backend/.env.example` 파일 생성 및 각 변수에 대한 설명 추가

```
# 서버 포트 (기본값: 3000)
PORT=3000

# 프론트엔드 URL (CORS 설정용)
FRONTEND_URL=http://localhost:3001

# 실행 환경 (development | production)
NODE_ENV=development
```

---

**[WARNING] 공개 API 엔드포인트 문서화 부재**
- 위치: `backend/src/player/player.controller.ts`, `backend/src/room/room.controller.ts`, `backend/src/hall-of-fame/hall-of-fame.controller.ts`
- 상세: REST API 엔드포인트(`GET /player/me`, `POST /player/nickname`, `GET /rooms`, `POST /rooms`, `GET /hall-of-fame`, `GET /hall-of-fame/:playerUuid/history`)가 추가되었으나, Swagger/OpenAPI 데코레이터나 API 문서가 전혀 없음. `@nestjs/swagger`를 활용하거나 별도 API 문서가 필요함
- 제안: 최소한 각 엔드포인트의 요청/응답 형태를 spec 디렉토리에 문서화하거나 `@nestjs/swagger` 도입

---

**[WARNING] WebSocket 이벤트 문서화 부족**
- 위치: `backend/src/common/types/events.types.ts`
- 상세: `WS_EVENTS` 상수에 클라이언트→서버, 서버→클라이언트 방향 주석이 있으나 각 이벤트의 payload 형태(데이터 구조)가 문서화되어 있지 않음. 프론트엔드 개발자가 각 이벤트에 어떤 데이터를 넘겨야 하는지 알기 어려움
- 제안: 각 이벤트 상수에 JSDoc으로 payload 타입 명시

```typescript
/**
 * @event room:join
 * @payload { roomId: string }
 * @response { success: boolean; room?: RoomState; error?: string }
 */
ROOM_JOIN: 'room:join',
```

---

**[INFO] 게임 엔진 핵심 클래스에 클래스 레벨 JSDoc 부재**
- 위치: `backend/src/game/engine/hand-evaluator.ts`, `backend/src/game/engine/pot-calculator.ts`, `backend/src/game/engine/betting-round.ts`
- 상세: 메서드 수준의 주석은 일부 있으나(`getValidActions`, `applyAction` 등), 클래스 자체의 역할과 사용 방법을 설명하는 클래스 레벨 JSDoc이 없음. 특히 `PotCalculator`는 사이드팟 계산 로직이 복잡함에도 설명 부족
- 제안:

```typescript
/**
 * 포커 팟 분배 계산기
 * 올인 플레이어가 있는 경우 메인팟/사이드팟을 분리하여 계산합니다.
 * @example
 * const calculator = new PotCalculator();
 * const pots = calculator.calculatePots(players);
 */
export class PotCalculator { ... }
```

---

**[INFO] `DatabaseModule`의 `synchronize: true` 설정 경고 없음**
- 위치: `backend/src/database/database.module.ts:10`
- 상세: TypeORM의 `synchronize: true`는 개발 환경에서만 사용해야 하며 프로덕션에서는 위험한 설정임. 이에 대한 주석이나 환경 분기 처리가 없음
- 제안:

```typescript
// ⚠️ synchronize: true는 개발 환경 전용입니다.
// 프로덕션에서는 반드시 false로 설정하고 마이그레이션을 사용하세요.
synchronize: process.env.NODE_ENV !== 'production',
```

---

**[INFO] `GameService`의 `any` 타입 반환 메서드 문서화 부족**
- 위치: `backend/src/game/game.service.ts:106,137,149,160`
- 상세: `getPublicState()`, `getPrivateStates()`, `getActionRequired()`, `handleAction()` 등 여러 메서드가 `any` 타입을 반환하고 있어, 실제 반환 구조를 주석이나 인터페이스로 문서화하지 않으면 사용자가 응답 구조를 파악하기 어려움
- 제안: 반환 타입을 인터페이스로 정의하거나 JSDoc `@returns` 태그로 구조 명시

---

**[INFO] `room.controller.ts`의 `(req as any).cookies` 사용 설명 부재**
- 위치: `backend/src/room/room.controller.ts:17`
- 상세: `PlayerController`와 달리 `RoomController`에서는 `@Req() req: express.Request`를 사용하면서 `(req as any).cookies`로 타입 캐스팅하는 이유가 설명되지 않음. 동일한 패턴을 `PlayerUuid` 데코레이터로 통일하지 않은 이유도 불명확
- 제안: 인라인 주석으로 이유 설명 또는 `PlayerUuid` 데코레이터 활용

---

**[INFO] `spec/` 디렉토리 문서 부재**
- 위치: 프로젝트 루트 `spec/`
- 상세: CLAUDE.md에 따르면 SDD(Spec-Driven Development)를 따라야 하나, 이번 대규모 1차 구현(백엔드 전체 + 게임 엔진)에 대응하는 스펙 문서가 `spec/` 디렉토리에 없음
- 제안: 게임 엔진, WebSocket 이벤트, REST API, 엔티티 설계에 대한 스펙 문서 작성

---

### 요약

이번 변경은 온라인 포커 백엔드의 핵심 구현(게임 엔진, WebSocket 게이트웨이, REST API, DB 엔티티)을 대규모로 추가하는 작업으로, 코드의 구현 품질은 전반적으로 양호합니다. 다만 문서화 관점에서는 환경 변수 설정 파일(`.env.example`) 부재, REST API 및 WebSocket 이벤트의 payload 문서화 미흡, 프로덕션 위험 설정(`synchronize: true`)에 대한 경고 주석 누락, 그리고 SDD 방법론에서 요구하는 `spec/` 문서 부재가 주요 문제입니다. 게임 엔진 클래스들은 메서드 수준의 주석은 일부 존재하나 클래스 레벨 문서와 사용 예시가 없어 유지보수 시 진입 장벽이 될 수 있습니다.

### 위험도

**MEDIUM**