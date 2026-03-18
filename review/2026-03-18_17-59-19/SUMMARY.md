# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - AI 플레이어 핵심 루프(`processAiTurnsOrNotify`)의 에러 처리 부재 및 보안 취약점(AI UUID 스푸핑)이 주요 위험 요소이며, 아키텍처·유지보수성 측면에서 복수의 중복 이슈가 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 안정성 | `processAiTurnsOrNotify`에 try-catch 없음 — AI 턴 처리 중 예외 발생 시 게임이 복구 불가능 상태로 중단되고 클라이언트에 아무 이벤트도 전달되지 않음 | `room.gateway.ts` - `processAiTurnsOrNotify` | 메서드 전체를 try-catch로 감싸고, 에러 발생 시 `this.server.to(roomId).emit('error', ...)` 등으로 클라이언트에 알림 |
| 2 | 보안 | AI UUID 스푸핑 — 악의적 클라이언트가 `playerUuid: "ai-player-1"` 전송으로 AI 플레이어 행동을 위조할 수 있음 | `game.service.ts` - `handleAction()` | `handleAction()` 진입부에서 `isAiPlayer(playerUuid)`이면 즉시 예외 처리 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 안정성/보안 | `while(true)` 무한 루프 위험 — 게임 엔진 버그 또는 AI 액션 무한 반복 시 Node.js 이벤트 루프 전체 블로킹, 서비스 중단 가능 | `room.gateway.ts` - `processAiTurnsOrNotify` | 최대 반복 횟수 가드(`const MAX_AI_TURNS = 100`) 추가 및 초과 시 게임 강제 종료 처리 |
| 2 | 동시성 | AI 루프 실행 중 인간 플레이어 액션 또는 `setTimeout`의 `startNextHand`가 동시에 `handleAction` 호출 — `await` 경계에서 게임 상태 인터리빙 가능 | `room.gateway.ts` - `processAiTurnsOrNotify` | `finishingRooms`과 유사한 `processingAiTurns = new Set<string>()` 가드 도입 |
| 3 | 메모리 | `aiPlayersMap`이 게임 종료 시에만 삭제됨 — 연결 오류, abandoned 종료, 플레이어 전원 접속 끊김 시 메모리 누수 | `room.gateway.ts` - `aiPlayersMap` | `handleDisconnect` 및 방 정리 로직에서 `aiPlayersMap.delete(roomId)` 추가 |
| 4 | 보안/유지보수 | `AI_UUID_PREFIX = 'ai-player-'` 상수와 SQL 필터 `NOT LIKE 'ai-%'` 불일치 — prefix 변경 시 쿼리 미반영으로 AI가 랭킹에 포함될 수 있음 | `hall-of-fame.service.ts:56, 87` / `ai-names.ts` | `.andWhere('gp.playerUuid NOT LIKE :prefix', { prefix: \`${AI_UUID_PREFIX}%\` })` 파라미터 바인딩으로 단일 소스 관리 |
| 5 | 유지보수 | `finishGame`과 `getGameResult`에 win/loss/draw/abandoned 판정 로직이 중복 구현 — 향후 한 곳만 수정하면 불일치 발생 | `game.service.ts:249-300`, `319-355` | `resolvePlayerResult(player, topChips, topCount)` private 헬퍼로 추출하여 단일화 |
| 6 | 아키텍처 | `RoomGateway`가 `aiPlayersMap` 상태 관리 + AI 의사결정 실행 + 브로드캐스트 모두 수행 — SRP 위반, Gateway 비대화 | `room.gateway.ts` | `aiPlayersMap`을 `RoomService`로 이전, AI 턴 처리 책임을 `GameService`로 위임 |
| 7 | 테스트 | `processAiTurnsOrNotify`(AI 연속 턴, 핸드 종료, 게임 종료 시나리오)에 대한 테스트 부재 — 가장 복잡한 통합 포인트 | `room.gateway.ts` | 메서드를 별도 서비스로 분리하거나 Gateway 테스트 파일 생성하여 핵심 시나리오 커버 |
| 8 | 테스트 | 확률적 테스트 CI 신뢰성 — `foldCount > 70` (100회 중) 조건은 블러프 확률(10%) 존재로 간헐적 실패 가능 | `ai-player.service.spec.ts:175-195` | `jest.spyOn(Math, 'random').mockReturnValue(0.5)`로 난수 고정 또는 임계값 완화 |
| 9 | 테스트 | `getDiscardIndices`의 Two Pair(4장 유지, 1장 버림) 및 Quads 케이스 테스트 누락 | `ai-player.service.spec.ts` | Two Pair 유지 테스트 케이스 추가 |
| 10 | 타입 안전성 | `hall-of-fame.service.ts`에서 `game!` → `game` 변경 후 null 체크 없이 `game.id` 접근 — TypeScript 타입 불안전 | `hall-of-fame.service.ts:157` | `if (!game) continue;` 가드 추가 또는 필터 타입 가드로 좁히기 |
| 11 | 데이터 정합성 | AI 플레이어가 1등일 경우 `finishGame` 루프에서 `i`가 증가하여 인간 플레이어 placement 번호 불연속 발생 | `game.service.ts` - `finishGame()` | human player만 필터링한 배열을 별도 생성 후 루프 처리 |
| 12 | API 계약 | 프론트엔드 `ActionRequired` 타입에 `isDraw` 필드 미정의 — 드로우 페이즈 정보 타입 계약 누락 | `game.service.ts:229-237` / `frontend/src/lib/types.ts` | `ActionRequired` 인터페이스에 `isDraw?: boolean` 추가 |
| 13 | API 계약 | `PlayerPublicState.isAI`가 서버는 항상 boolean 반환, 프론트엔드는 `isAI?: boolean` optional 선언 — 타입 불일치 | `game.service.ts:196` / `frontend/src/lib/types.ts` | 서버 응답 타입을 `isAI: boolean`으로 고정하거나 프론트엔드도 non-optional로 통일 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/유지보수 | `scoreMap` 객체가 `evaluateHandStrength` 호출마다 새로 생성 — AI 턴마다 불필요한 힙 할당 | `ai-player.service.ts` - `evaluateHandStrength` | 클래스 레벨 `private static readonly SCORE_MAP`으로 추출 |
| 2 | 아키텍처 | `decideAction`의 `variant` 파라미터가 `gameState.variant`로도 접근 가능 — 중복 파라미터 | `ai-player.service.ts` | `variant` 파라미터 제거, 내부에서 `gameState.variant` 사용 |
| 3 | 유지보수 | AI UUID가 `ai-player-1`, `ai-player-2` 고정값 — 다중 방 동시 진행 시 UUID 중복, 식별자 혼동 가능성 | `ai-player.service.ts:27` | `ai-player-{roomId}-{n}` 형식으로 방별 고유 UUID 생성 검토 |
| 4 | 유지보수 | `getGameResult`가 `Promise<any>` 반환 — 호출부 타입 안전성 없음 | `game.service.ts:319` | `GameResult` 인터페이스 정의 후 반환 타입 명시 |
| 5 | 의존성 | `AiPlayerService`가 `HandEvaluator`를 `new HandEvaluator()`로 직접 인스턴스화 — DI 우회로 테스트 mocking 어려움 | `ai-player.service.ts:23` | `HandEvaluator`를 `@Injectable()`로 선언하고 NestJS DI 주입 검토 |
| 6 | 의존성 | `GameService`가 `ai-names.ts`를 import하고, `AiPlayerService`가 `HandEvaluator`(game 모듈)를 import — 양방향 참조 구조적 취약 | `game.service.ts`, `ai-player.service.ts` | `HandEvaluator`를 shared 모듈로 분리하여 단방향 의존성 유지 |
| 7 | 문서화 | `checkAllReady` 조건 변경(`< 2` → `< 1`) 이유 주석 없음 — 버그처럼 보일 수 있음 | `room.service.ts:276` | `// AI players fill remaining seats, so 1 human is sufficient` 주석 추가 |
| 8 | 문서화 | 스펙의 프리플롭 강도 수치(AKs=0.85 등)와 실제 수식 기반 구현값 불일치 | `spec/10-ai-player.md` / `ai-player.service.ts` | 스펙을 실제 공식 기반으로 업데이트하거나 "참고용 근사치" 표기 추가 |
| 9 | 문서화 | `processAiTurnsOrNotify`의 `while(true)` 루프 종료 조건 주석 없음 | `room.gateway.ts` | `// Runs until human player's turn or game ends` 주석 추가 |
| 10 | 데이터베이스 | `filter(Boolean)` 후 TypeScript 타입이 `string[]`으로 좁혀지지 않음 | `hall-of-fame.service.ts:135` | `filter((id): id is string => Boolean(id))` 타입 가드 사용 |
| 11 | 테스트 | `evaluateHandStrength` 테스트에서 `expect(score).toBe(0.1)` 하드코딩 — scoreMap 조정 시 테스트 깨짐 | `ai-player.service.spec.ts:100` | `expect(score).toBeLessThan(0.3)` 등 범위 검증으로 변경 |
| 12 | 스코프 | `pot-calculator.spec.ts`, `player.controller.ts`에 AI 플레이어 기능과 무관한 포맷팅 변경 포함 | 해당 파일 전체 | 기능 PR과 포맷팅 변경 분리 권장 |
| 13 | 테스트 | `HallOfFameService`의 AI UUID 랭킹 필터링 검증 테스트 부재 | `hall-of-fame.service.ts` | HallOfFame spec 파일에 AI 플레이어 필터링 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | AI UUID 스푸핑, while(true) DoS 위험, UUID prefix 이중 관리 |
| concurrency | MEDIUM | processAiTurnsOrNotify await 경계 인터리빙, processingAiTurns 가드 부재 |
| architecture | MEDIUM | Gateway SRP 위반(aiPlayersMap + AI 의사결정), AI 식별 prefix 추상화 누락 |
| maintainability | MEDIUM | finishGame/getGameResult 로직 중복, processAiTurnsOrNotify 과도한 책임 |
| testing | MEDIUM | processAiTurnsOrNotify 테스트 부재, 확률적 테스트 불안정, Two Pair 케이스 누락 |
| requirement | MEDIUM | processAiTurnsOrNotify 에러 처리 부재, 스펙-구현 수치 불일치 |
| side_effect | MEDIUM | while(true) 무한 루프, aiPlayersMap 메모리 누수, hall-of-fame null 체크 |
| performance | LOW | while(true) 이벤트 루프 점유, scoreMap 반복 생성, isAiPlayer map 내 반복 호출 |
| api_contract | LOW | isDraw 타입 미정의, isAI optional/non-optional 불일치, hall-of-fame prefix 하드코딩 |
| database | LOW | NOT LIKE 파라미터 바인딩 미사용, placement 번호 불연속, filter 타입 가드 |
| documentation | LOW | 스펙-구현 수치 불일치, while(true) 주석 부재, checkAllReady 변경 이유 미문서화 |
| dependency | LOW | AiModule ↔ GameModule 양방향 참조, AI_UUID_PREFIX SQL 미동기화, HandEvaluator DI 우회 |
| scope | LOW | 기능 무관 포맷팅 변경 혼재 |

---

## 발견 없는 에이전트
없음 (모든 에이전트가 발견사항을 보고함)

---

## 권장 조치사항

1. **[즉시] AI UUID 스푸핑 차단** — `game.service.ts`의 `handleAction()` 진입부에 `isAiPlayer(playerUuid)` 검사 추가하여 외부 AI 행동 위조 방지
2. **[즉시] `processAiTurnsOrNotify` 에러 처리 추가** — 전체 try-catch 래핑, 에러 시 클라이언트에 이벤트 전송으로 게임 중단 방지
3. **[즉시] `while(true)` 루프 최대 반복 제한** — `MAX_AI_TURNS` 가드 추가로 무한 루프·DoS 위험 해소
4. **[단기] `processAiTurnsOrNotify` 동시 실행 방어** — `processingAiTurns = new Set<string>()` 가드 도입으로 AI 루프와 인간 액션 인터리빙 방지
5. **[단기] `AI_UUID_PREFIX` 상수 SQL 동기화** — `hall-of-fame.service.ts`의 하드코딩 `'ai-%'`를 파라미터 바인딩으로 교체
6. **[단기] `aiPlayersMap` 메모리 누수 해소** — `handleDisconnect` 및 abandoned 종료 경로에 `aiPlayersMap.delete(roomId)` 추가
7. **[단기] `finishGame`/`getGameResult` 결과 판정 로직 통합** — private 헬퍼 메서드로 추출하여 중복 제거
8. **[단기] 프론트엔드 타입 동기화** — `ActionRequired`에 `isDraw?: boolean` 추가, `isAI` optional/non-optional 통일
9. **[중기] `processAiTurnsOrNotify` 책임 분리** — AI 의사결정·상태 관리를 `GameService`로 위임, Gateway는 브로드캐스트만 담당
10. **[중기] 테스트 보강** — 확률적 테스트 난수 고정, Two Pair 케이스 추가, HallOfFame AI 필터링 검증 추가