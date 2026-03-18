# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 동시성 경쟁 조건, 게임 로직 버그, 테스트 공백, DB 안전성 문제가 복합적으로 존재하여 서비스 안정성에 직접적인 위협이 됩니다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `handleAction()`의 `await` 구간에서 동일 room의 다른 WebSocket 이벤트가 끼어들어 핸드 종료 처리 중 상태 오염 발생 | `game.service.ts` — `handleAction()` | `activeGames`에서 먼저 제거하거나 `isFinishing` 플래그로 중복 진입 차단 |
| 2 | 동시성 | `joinRoom()` 인원 확인→좌석 배정 사이 TOCTOU 경쟁으로 동일 `seatIndex` 중복 배정 시 500 에러 노출 | `room.service.ts` — `joinRoom()` | `QueryFailedError` 포착 후 `BadRequestException` 변환, 또는 비관적 락 적용 |
| 3 | 게임 로직 | `PotCalculator.calculatePots()`의 `partialContributors` 변수가 선언만 되고 사용되지 않아 사이드팟 계산 로직 불완전 | `pot-calculator.ts:46–50` | 변수 제거 또는 실제 팟 계산 로직에 반영하여 올인 시나리오 재검토 |
| 4 | 게임 로직 | 세븐카드 스터드에서 앤티 수집 후 `p.currentBet = anteAmount` 설정 직후 `p.currentBet = 0`으로 재초기화하여 베팅 라운드 계산 불일치 | `seven-card-stud.engine.ts` — `startHand()` | 앤티 수집과 베팅 라운드 초기화를 명확히 분리 |
| 5 | 게임 로직 | 핸드 종료 후 게임이 계속되는 경우 `startNextHand()` 자동 호출 경로 없음 | `game.service.ts` — `handleAction()` | 반환값에 `nextHandReady` 플래그 추가 또는 Gateway에서 딜레이 후 자동 호출 |
| 6 | 테스트 | `PotCalculator` 테스트 전무 — 금전 계산 핵심 로직에 사이드팟 시나리오 검증 없음 | `game/engine/pot-calculator.ts` | 올인 플레이어 포함 3인 이상 다양한 사이드팟 시나리오 테스트 작성 |
| 7 | 테스트 | `GameService` 테스트 전무 — `handleAction`, `startGame`, `finishGame` 등 핵심 비즈니스 로직 미검증 | `game/game.service.ts` | `@nestjs/testing` + TypeORM in-memory SQLite 통합 테스트 작성 |
| 8 | 테스트 | `RoomService`/`RoomGateway` 테스트 전무 — 방 상태 머신 전체 미검증 | `room/room.service.ts`, `room.gateway.ts` | 서비스 단위 테스트 및 게이트웨이 이벤트 처리 테스트 작성 |
| 9 | API 계약 | 인증 실패 시 `{ success: false }` 200 OK와 `BadRequestException` 형식이 동일 컨트롤러에서 혼재 | `room.controller.ts:18–21` | `throw new UnauthorizedException()` 로 통일하거나 Global Exception Filter 도입 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DB 안전성 | `synchronize: true` 하드코딩 — 프로덕션에서 자동 스키마 변경으로 데이터 손실 위험 | `database.module.ts:11` | `synchronize: process.env.NODE_ENV !== 'production'` |
| 2 | DB 성능 | `getPlayerHistory()`에서 게임 수 N에 비례하는 N+1 쿼리 발생 | `hall-of-fame.service.ts:130–155` | `gameId IN (...)` 배치 조회 또는 JOIN 단일 쿼리로 처리 |
| 3 | DB 정합성 | 방 생성 시 `room` 저장→`roomPlayer` 저장 사이 트랜잭션 미사용 | `room.service.ts:54–76` | `manager.transaction()` 으로 원자적 처리 |
| 4 | DB 정합성 | 게임 종료 처리(`finishGame`) 전체에 트랜잭션 미사용 | `game.service.ts:210–245` | 단일 트랜잭션으로 처리 |
| 5 | DB 성능 | `playerUuid`, `room.status`, `game_participant.gameId`, `game.status` 컬럼 인덱스 누락 | 각 엔티티 파일 | `@Index()` 데코레이터 추가 |
| 6 | 보안 | `player_uuid` 쿠키에 서명 없어 클라이언트가 임의 UUID로 타인 사칭 가능 | `player.controller.ts`, `nickname-required.guard.ts` | `cookieParser(secret)` + `signed: true` + `req.signedCookies` 사용 |
| 7 | 보안 | WebSocket `GAME_ACTION` 처리 시 클라이언트 전송 payload의 UUID를 신뢰하면 게임 액션 조작 가능 | `room.gateway.ts` | `client.handshake.headers.cookie` 또는 `client.data` 에서 UUID 추출 |
| 8 | 보안 | `Math.random()` 기반 카드 셔플 — 암호학적으로 안전하지 않아 게임 공정성 저하 | `deck.ts:24` | `crypto.randomInt()` 사용 |
| 9 | 보안 | 홀 카드 배포 시 잘못된 소켓 타겟에 전송되면 모든 플레이어 카드 노출 위험 | `game.service.ts:173–180` | Gateway에서 소켓 ID↔UUID 매핑 검증 후 특정 소켓에만 emit |
| 10 | 동시성 | `setNickname()` check-then-save 사이 TOCTOU로 DB 유니크 위반 시 500 에러 노출 | `player.service.ts` — `setNickname()` | `save()` try-catch에서 `QueryFailedError`를 `BadRequestException`으로 변환 |
| 11 | 동시성 | `toggleReady()` read-modify-write 패턴으로 빠른 중복 요청 시 토글이 한 번만 적용 | `room.service.ts` — `toggleReady()` | DB 레벨 원자적 반전 쿼리 또는 명시적 ready/unready 상태 전송으로 변경 |
| 12 | 동시성 | `findOrCreate()` 동시 요청 시 PK 충돌 에러 전파 | `player.service.ts` — `findOrCreate()` | `upsert` 또는 충돌 시 재조회 패턴 적용 |
| 13 | 아키텍처 | `RoomModule` ↔ `GameModule` `forwardRef` 순환 의존성 | `room.module.ts:9` | `GameSessionModule` 독립 오케스트레이터 레이어로 분리 또는 이벤트 기반 분리 |
| 14 | 아키텍처 | `NicknameRequiredGuard`가 `common` 레이어에서 `player` 피처 모듈에 의존 (레이어 역전) | `common/guards/nickname-required.guard.ts` | Guard를 `PlayerModule` 내부로 이동하거나 인터페이스 DI 사용 |
| 15 | 아키텍처 | `GameService`가 엔진 관리·인메모리 상태·게임 진행·DB 영속화·결과 집계 모두 담당 (SRP 위반) | `game.service.ts` 전체 | `GameSessionManager`, `GamePersistenceService`, `GameResultService`로 분리 |
| 16 | 아키텍처 | 서버 재시작 시 `activeGames` Map 소멸로 진행 중 게임 상태 손실 및 DB 정합성 불일치 | `game.service.ts:27` | 시작 시 `in-progress` 게임을 `abandoned`로 업데이트하는 초기화 로직 추가 |
| 17 | 코드 품질 | `RoomController`에서 이미 구현된 `@PlayerUuid()` 데코레이터 대신 `(req as any).cookies` 사용 | `room.controller.ts:19` | `@PlayerUuid() uuid: string` 데코레이터로 교체 |
| 18 | 코드 품질 | `PlayerController`가 `@Res()` 직접 사용으로 NestJS 인터셉터·직렬화 파이프 무력화 | `player.controller.ts:14, 33` | `@Res({ passthrough: true })` 또는 쿠키 설정 인터셉터로 분리 |
| 19 | 코드 품질 | `GameService` 공개 메서드 다수가 `any` 반환 타입 — 컴파일 타임 오류 감지 불가 | `game.service.ts:100, 159, 162, 173` | `PublicGameState`, `ActionRequired` 등 명시적 인터페이스 정의 |
| 20 | 코드 품질 | `PlayerController` UUID 생성 및 쿠키 설정 블록이 `getMe`·`setNickname` 양쪽에 중복 | `player.controller.ts` | `private setCookieAndGetUuid(req, res)` 헬퍼 메서드 추출 |
| 21 | 게임 로직 | `findNextActivePlayer()`에서 활성 플레이어 없을 때 `fromIndex` 반환 — 이후 폴드/올인 플레이어에게 액션 요청 가능 | `betting-round.ts:218` | `-1` 또는 `null` 반환 후 호출부에서 처리 |
| 22 | API 계약 | `POST /player/nickname`에 DTO 없이 raw Body 추출 — ValidationPipe 미작동 | `player.controller.ts:37` | `SetNicknameDto` + `@IsString() @Length(2, 20)` 적용 |
| 23 | API 계약 | `GET /hall-of-fame` 엔드포인트에 인증 없어 타 플레이어 기록 무제한 조회 가능 | `hall-of-fame.controller.ts` | `NicknameRequiredGuard` 적용 또는 쿠키 기반 자신 기록만 허용 |
| 24 | API 계약 | URL 네이밍 일관성 없음: `/player`(단수), `/rooms`(복수), `/hall-of-fame`(케밥) 혼재 | 컨트롤러 전체 | 복수형 통일: `/players/me`, `/players/me/nickname`, `/rooms` |
| 25 | 테스트 | `FiveCardDraw` 엔진 테스트 전무 — 드로우 카드 교환 로직 미검증 | `variants/five-card-draw.engine.ts` | Texas Hold'em 엔진 테스트 패턴 참고하여 작성 |
| 26 | 테스트 | `SevenCardStud` 엔진 테스트 전무 — 브링인·스트리트별 딜링 미검증 | `variants/seven-card-stud.engine.ts` | 기본 핸드 진행 및 브링인 결정 테스트 작성 |
| 27 | 테스트 | `BettingRound` 테스트에서 인스턴스를 `describe` 최상단에 한 번만 생성하여 테스트 간 상태 오염 위험 | `betting-round.spec.ts:8` | `beforeEach`로 이동하여 독립 인스턴스 보장 |
| 28 | 의존성 | `socket.io@^4.8.3`을 `@nestjs/platform-socket.io@^11`과 별도 선언하여 버전 불일치 위험 | `backend/package.json` | `socket.io` 직접 선언 제거하고 NestJS peer dependency로 관리 |
| 29 | DB 설계 | `room.entity.ts`의 `settings` 컬럼이 JSON 문자열로 저장 — 타입 안전성 없음 | `room.entity.ts:36` | `@Column({ type: 'simple-json' }) settings: RoomSettings` 로 변경 |
| 30 | 게임 로직 | `finishGame()`에서 동일 칩 보유 시 `draw` 처리 없이 `i === 0` 무조건 `win` 처리 | `game.service.ts` — `finishGame()` | 동일 칩 보유 플레이어 다수일 때 `draw` 처리 로직 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `PORT`, `FRONTEND_URL`, `NODE_ENV` 등 환경 변수 문서화 없음 | `backend/src/main.ts` | `backend/.env.example` 파일 생성 |
| 2 | 문서화 | REST API 및 WebSocket 이벤트 payload 형식 문서화 없음 | 컨트롤러, `events.types.ts` | `@nestjs/swagger` 도입 또는 `spec/` 에 API 문서 작성 |
| 3 | 문서화 | SDD 방법론 요구에도 불구하고 `spec/` 디렉토리에 스펙 문서 부재 | `spec/` | 게임 엔진·WebSocket·REST API·엔티티 설계 스펙 문서 작성 |
| 4 | 문서화 | `synchronize: true` 에 프로덕션 위험 경고 주석 없음 | `database.module.ts:10` | 인라인 경고 주석 추가 |
| 5 | 코드 품질 | `game.service.ts` 의 `uuidv4` import가 미사용 | `game.service.ts:6` | import 제거 |
| 6 | 코드 품질 | `player.service.ts`의 `createPlayer()` 메서드가 어디서도 호출되지 않는 데드 코드 | `player.service.ts:31–35` | 제거 또는 UUID 생성 책임 서비스로 이전 |
| 7 | 코드 품질 | `room.controller.ts`에서 `import * as express` 대신 다른 컨트롤러와 다른 import 패턴 사용 | `room.controller.ts:3` | `import type { Request } from 'express'` 로 통일 |
| 8 | 코드 품질 | `SevenCardStudEngine.advancePhase()` 에서 `fourth/fifth/sixth-street` 케이스 동일 패턴 반복 | `seven-card-stud.engine.ts:259–297` | 페이즈 순서 배열 + 공통 deal 함수로 리팩터링 |
| 9 | 코드 품질 | `GameService.getPrivateStates()`가 `holeCards` 배열의 직접 참조 반환 — 외부 변경 시 상태 오염 | `game.service.ts` | `[...player.holeCards]` 복사본 반환 |
| 10 | 아키텍처 | `GameState.deck` 필드가 공개 상태에 포함되어 직렬화 시 전체 덱이 클라이언트에 노출될 수 있음 | `game.types.ts:83` | 공개 상태 DTO에서 `deck` 필드 명시적 제외 |
| 11 | 아키텍처 | `PokerEngineFactory` 새 변형 추가 시 `switch` 문 수정 필요 (OCP 위반) | `poker-engine.factory.ts:14–24` | `Map<PokerVariant, () => IPokerEngine>` 레지스트리 패턴 적용 |
| 12 | 아키텍처 | `HallOfFameModule`이 타 모듈 엔티티(`Game`, `GameParticipant`, `Player`)를 직접 소유 | `hall-of-fame.module.ts` | 각 모듈이 Repository 또는 query facade를 export하도록 설계 |
| 13 | 테스트 | `TournamentMode` 블라인드 레벨 경계값 테스트 없음 | `modes/tournament.mode.ts` | 레벨 초과 시 마지막 레벨 유지 등 경계값 테스트 추가 |
| 14 | 테스트 | `NicknameRequiredGuard`, `HallOfFameService` 테스트 없음 | 해당 파일들 | 각 3가지 통과/실패 시나리오 테스트 작성 |
| 15 | 테스트 | 프론트엔드 테스트 전무 | `frontend/app/game/[roomId]/page.tsx` | `useGameStore`, `useSocket` 훅 단위 테스트 및 컴포넌트 테스트 추가 |
| 16 | API 계약 | API 버전 관리 없어 향후 breaking change 시 클라이언트 마이그레이션 경로 부재 | 컨트롤러 전체 | `enableVersioning()` 또는 `/api/v1/` prefix 설정 |
| 17 | API 계약 | `GET /rooms` 페이지네이션 없어 방 다수 시 응답 크기 문제 | `room.service.ts:82–95` | `page`, `limit` 쿼리 파라미터 추가 |
| 18 | 보안 | URL 경로 파라미터 `playerUuid` 형식 검증 없음 | `hall-of-fame.controller.ts:21` | `ParseUUIDPipe` 적용 |
| 19 | 보안 | 쿠키에서 읽은 UUID의 형식 검증 없음 | `player.controller.ts:17, 39` | `uuid` 패키지의 `validate()` 함수로 UUID v4 형식 검증 |
| 20 | 의존성 | `@types/uuid@^10`이 uuid v13 내장 타입과 중복될 가능성 | `backend/package.json` | uuid v13 자체 타입 확인 후 `@types/uuid` 제거 검토 |
| 21 | 성능 | `BettingRound.cloneState()`에서 매 액션마다 `JSON.parse(JSON.stringify(state))` 전체 상태 깊은 복사 | `betting-round.ts:238` | `structuredClone()` 또는 immer 도입, `deck`을 `GameState`에서 분리 검토 |
| 22 | UX | 게임 중 페이지 새로고침 시 `gameState`, `holeCards` 복구 로직 없음 | `frontend/app/game/[roomId]/page.tsx` | 조인 응답에 현재 게임 공개 상태 포함 또는 별도 `GAME_STATE` 재요청 |
| 23 | DB 설계 | SQLite 파일 경로가 `__dirname` 기반 — 빌드 구조 변경 시 위치 달라짐 | `database.module.ts:9` | `process.env.DB_PATH ?? join(process.cwd(), 'data', 'poker.sqlite')` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| database | HIGH | synchronize: true, N+1 쿼리, 트랜잭션 미사용 |
| testing | HIGH | PotCalculator·GameService·RoomService 테스트 전무 |
| requirement | HIGH | 사이드팟 버그, 앤티 초기화 충돌, nextHand 흐름 불명확 |
| architecture | HIGH | 인메모리 게임 상태, 순환 의존성, SRP 위반 |
| concurrency | HIGH | handleAction 경쟁 조건, joinRoom TOCTOU |
| api_contract | HIGH | 에러 응답 형식 불일치, 인증 없는 공개 엔드포인트 |
| security | MEDIUM | 쿠키 서명 없음, WebSocket UUID 신뢰, Math.random() 셔플 |
| maintainability | MEDIUM | any 타입 남용, N+1 쿼리, handleAction 단일 책임 위반 |
| performance | MEDIUM | N+1 쿼리, 전체 상태 깊은 복사 반복 |
| side_effect | MEDIUM | synchronize: true, 인메모리 상태 서버 재시작 손실, @Res() 직접 사용 |
| scope | MEDIUM | PlayerUuid 데코레이터 미사용, 데드 코드, synchronize: true |
| documentation | MEDIUM | 환경 변수 미문서화, API 문서 부재, spec/ 디렉토리 없음 |
| dependency | LOW | socket.io 버전 불일치 가능성, @types/uuid 중복 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 개선이 필요한 발견사항을 보고함)

---

## 권장 조치사항

1. **[즉시] 동시성 경쟁 조건 수정** — `handleAction()` async 구간의 상태 보호, `joinRoom()`·`setNickname()`·`findOrCreate()`의 DB 제약 위반 에러 처리
2. **[즉시] 게임 로직 버그 수정** — `PotCalculator` 사이드팟 로직 완성, 세븐카드 스터드 앤티 초기화 충돌 해결, 멀티핸드 `startNextHand()` 흐름 구현
3. **[높음] `synchronize: true` 환경 분기** — `process.env.NODE_ENV !== 'production'` 조건 적용
4. **[높음] 핵심 테스트 작성** — `PotCalculator`, `GameService`, `RoomService`/`RoomGateway` 테스트 우선 작성
5. **[높음] 쿠키 보안 강화** — `cookieParser(secret)` + `signed: true` 적용, WebSocket 핸들러에서 서명된 쿠키로 UUID 검증
6. **[중간] N+1 쿼리 제거** — `getPlayerHistory()` `gameId IN (...)` 배치 조회 또는 JOIN으로 개선
7. **[중간] 트랜잭션 적용** — 방 생성, 게임 종료 처리를 단일 트랜잭션으로 묶기
8. **[중간] API 계약 정비** — 에러 응답 형식 통일, `SetNicknameDto` 도입, Hall of Fame 인증 가드 추가, `@PlayerUuid()` 데코레이터 일관 사용
9. **[중간] `any` 타입 제거** — `GameService` 공개 메서드 반환 타입을 명시적 인터페이스로 교체
10. **[낮음] 문서화 및 코드 정리** — `.env.example` 생성, `spec/` 스펙 문서 작성, 데드 코드 제거, 인덱스 추가