## 의존성 코드 리뷰

### 발견사항

---

- **[WARNING]** `RoomModule` ↔ `GameModule` 순환 의존성
  - 위치: `room/room.module.ts`, `room/room.service.ts`
  - 상세: `RoomModule`이 `forwardRef(() => GameModule)`을 사용하고 있으며, `RoomService`가 `GameService`를 직접 주입받고 있음. `forwardRef`는 NestJS가 순환 참조를 강제 해결하는 임시방편으로, 초기화 순서 문제나 런타임 `undefined` 참조 오류를 발생시킬 수 있음. 실제로 `leaveRoom()`에서 `gameService.deleteByRoom()`을 호출하고 있어 강한 결합이 존재함.
  - 제안: `GameService.deleteByRoom()`을 이벤트 기반(`EventEmitter`)으로 분리하거나, 공통 의존성을 담당하는 `GameCleanupService` 같은 별도 모듈로 추출하여 순환 참조를 제거.

---

- **[WARNING]** `uuid` 패키지가 엔진 레이어에서 직접 사용됨
  - 위치: `texas-holdem.engine.ts:17`, `five-card-draw.engine.ts:17`, `seven-card-stud.engine.ts:18`
  - 상세: 세 엔진 모두 `v4 as uuidv4`를 `initialize()`에서 `gameId` 생성 용도로만 사용하고 있음. 순수 게임 로직을 담당하는 엔진 레이어가 외부 패키지(`uuid`)에 직접 의존하면 단위 테스트 격리가 어려워지고, 엔진을 재사용할 때 불필요한 의존성이 딸려옴.
  - 제안: `gameId`를 `PokerEngineFactory` 또는 `GameService` 레이어에서 생성하여 `initialize()`의 파라미터로 전달하거나, `GameState`의 `gameId`를 옵셔널로 만들어 엔진이 ID 생성에 관여하지 않도록 분리.

---

- **[WARNING]** `hall-of-fame.service.ts`의 N+1 부분 해결을 위해 `In` 연산자 추가
  - 위치: `hall-of-fame.service.ts` — `import { In, Repository } from 'typeorm'`
  - 상세: `In` 연산자 사용 자체는 적절하나, `gameIds.length > 0` 조건 분기 없이 빈 배열로 `In([])` 쿼리를 실행하면 일부 DB에서 SQL 오류가 발생할 수 있음. 현재 코드는 조건 분기가 있어 안전하지만, TypeORM의 `In` 연산자가 빈 배열을 어떻게 처리하는지는 DB 드라이버(SQLite)에 의존적임.
  - 제안: 현재 구현이 안전하게 처리하고 있으므로 유지. 단, 주석으로 의도를 명시하는 것을 권장.

---

- **[INFO]** `package.json` / `package-lock.json` 미제공으로 버전 고정 상태 검증 불가
  - 위치: `backend/package-lock.json` (git status에서 수정됨)
  - 상세: 변경된 `package-lock.json` 내용이 포함되지 않아 실제 의존성 버전, 신규 패키지 추가 여부, 보안 취약점을 직접 검증할 수 없음. `uuid`, `typeorm`, NestJS 버전이 고정되어 있는지 확인 필요.
  - 제안: `npm audit`을 실행하여 알려진 취약점 여부를 확인하고, 주요 패키지는 `^` 대신 정확한 버전으로 고정하는 것을 권장.

---

- **[INFO]** `cookie-parser` 외부 미들웨어 사용
  - 위치: `main.ts:3`
  - 상세: NestJS에서 `cookie-parser`는 별도 패키지지만 사실상 표준적인 선택. 사용 방식(`app.use(cookieParser())`)도 적절함. 다만 `@nestjs/platform-fastify`를 사용할 경우 호환성 문제 발생 가능.
  - 제안: 현재 Express 기반이므로 문제 없음. 추후 Fastify 마이그레이션 시 `@fastify/cookie`로 교체 필요.

---

- **[INFO]** 게임 엔진 내 `JSON.parse/JSON.stringify` 딥 카피 패턴
  - 위치: 세 엔진 파일의 `startHand()`, `handleAction()`, `advancePhase()` 등
  - 상세: 의존성 관점에서 외부 패키지 없이 구현된 점은 긍정적이나, `Date` 객체나 `undefined` 값이 포함된 경우 직렬화 과정에서 데이터 손실이 발생할 수 있음. 현재 `GameState`가 순수 직렬화 가능한 타입으로 구성되어 있다면 허용 가능.
  - 제안: 향후 상태가 복잡해질 경우 `structuredClone()` (Node.js 17+)으로 교체하면 더 안전하고 성능도 개선됨. 별도 의존성 불필요.

---

- **[INFO]** `AiPlayerModule` 의존성 추가
  - 위치: `room/room.module.ts:11`
  - 상세: `RoomModule`이 `AiPlayerModule`에 의존하고 있음. AI 기능이 핵심 룸 로직과 강하게 결합된 구조. AI 플레이어 기능이 선택적이거나 나중에 비활성화해야 할 경우 분리가 어려움.
  - 제안: 당장 변경이 필요한 수준은 아니나, AI 로직을 게이트웨이 레벨에서 처리하는 방향으로 점진적 분리를 고려.

---

### 요약

의존성 구조 전반적으로 NestJS 생태계(`TypeORM`, `class-validator`, `uuid`, `cookie-parser`) 내에서 표준적인 선택을 하고 있으며, 불필요한 외부 패키지 추가는 발견되지 않았습니다. 가장 주목할 문제는 `RoomModule`과 `GameModule` 간의 순환 의존성으로, `forwardRef`로 임시 해결하고 있으나 장기적으로 아키텍처 리팩토링이 필요합니다. 또한 순수 게임 엔진 레이어가 `uuid`를 직접 참조하는 점은 책임 분리 원칙에 어긋나며, 테스트 격리성을 저해합니다. `package-lock.json`의 실제 변경 내용이 미제공되어 신규 패키지 추가나 보안 취약점 여부를 직접 검증할 수 없는 점은 리뷰의 한계입니다.

### 위험도

**MEDIUM** (순환 의존성이 런타임 오류 잠재 위험 보유, 나머지는 구조적 개선 권고 수준)