파일 쓰기 권한이 필요합니다. 허용해 주시면 `review/2026-03-19_00-40-54/SUMMARY.md`에 통합 보고서를 작성하겠습니다.

---

아래는 13개 에이전트 리뷰를 통합한 최종 보고서입니다:

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 보안 취약점(CSPRNG 미사용, 입력 검증 부재), 핵심 게임 규칙 버그(스터드 베팅 순서), 대규모 코드 중복(`resolveHand` 3중 복제), 테스트 커버리지 공백이 복합적으로 존재합니다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `Math.random()` 사용으로 카드 셔플이 암호학적으로 안전하지 않음. 카드 시퀀스 예측을 통한 치팅 가능 | `deck.js`, 셔플 로직 전체 | `crypto.randomInt()`로 교체 |
| 2 | Maintainability/Architecture | `resolveHand` 로직이 세 엔진에 거의 동일하게 복제됨. 버그 수정 시 세 곳 모두 수정해야 함 | `texas-holdem.engine.ts`, `five-card-draw.engine.ts`, `seven-card-stud.engine.ts` | `BasePokerEngine` 추상 클래스 또는 `HandResolver` 도메인 서비스 추출 |
| 3 | Requirement | Seven Card Stud 베팅 순서를 카드 값 합산으로 결정. 페어가 에이스보다 낮게 평가되는 규칙 위반 | `seven-card-stud.engine.ts:findHighestVisibleHand()` | `handEvaluator.evaluate(visibleCards)`로 실제 핸드 랭크 비교 |
| 4 | Testing | `TournamentMode` 테스트 없음. `getCurrentLevel` 경계 조건 미검증 | `tournament.mode.ts` | `tournament.mode.spec.ts` 작성 |
| 5 | Testing | `HallOfFameService` 테스트 없음. 복잡한 SQL 집계, N+1 해결 로직 미검증 | `hall-of-fame.service.ts` | `hall-of-fame.service.spec.ts` 작성 |
| 6 | Architecture | 엔진 인스턴스가 `private deck = new Deck()` 필드를 가져 순수 함수형 인터페이스와 충돌 | `texas-holdem.engine.ts:22`, `five-card-draw.engine.ts:22`, `seven-card-stud.engine.ts:24` | `Deck` 생성을 `startHand` 내 지역 변수로 이동하여 stateless 전환 |

## 경고 (WARNING) — 주요 항목

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | Security | 쿠키 UUID 형식 미검증 → AI 플레이어 위장 가능, 임의 문자열이 PK로 DB 저장 | `player.controller.ts`, `game.service.ts` |
| 2 | Security | `RoomSettings` 깊은 검증 부재 → 음수 블라인드 등 게임 규칙 조작 가능 | `create-room.dto.ts` |
| 3 | Security | WebSocket 액션의 `playerUuid` 클라이언트 페이로드 신뢰 시 타인 대신 행동 가능 | `room.gateway.ts` |
| 4 | Security | Rate Limiting 부재 | `main.ts`, `player.controller.ts` |
| 5 | Architecture | `GameService` God Object — 인메모리 상태, DB, 정산, AI 필터링 모두 담당 | `game.service.ts` |
| 6 | Architecture/Dependency | `RoomModule` ↔ `GameModule` 순환 의존성 (`forwardRef` 임시 해결 중) | `room.module.ts` |
| 7 | Requirement | `IGameMode.getAnte()` 인터페이스가 실제로 사용되지 않음 | `game-mode.interface.ts`, `seven-card-stud.engine.ts` |
| 8 | Requirement | Texas Hold'em `playerHands.cards` 필드에 홀 카드 2장만 저장. 쇼다운 시 공용 카드 누락 | `texas-holdem.engine.ts:resolveHand()` |
| 9 | Requirement/Scope | Five Card Draw 덱 부족 시 현재 플레이어 버린 카드만 재활용 → 카드 중복 가능 | `five-card-draw.engine.ts:handleDraw()` |
| 10 | Database | `leaveRoom` 다중 DB 작업이 단일 트랜잭션 밖에서 실행 | `room.service.ts:leaveRoom()` |
| 11 | Database | `playerUuid`, `game.roomId`, `room.status`, `game.status` 인덱스 누락 | 각 entity 파일 |
| 12 | Testing | 엔진 spec 파일에서 인스턴스 공유 → 테스트 간 상태 오염 가능 | 세 엔진 spec 파일 |
| 13 | Testing | `PlayerService`, `SevenCardStudEngine` 풀 핸드, AI 가드 로직 미테스트 | 해당 파일들 |
| 14 | Side Effect | `startGame()` 중복 호출 시 기존 게임 엔트리 무음 덮어쓰기 | `game.service.ts:startGame()` |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | CSPRNG 미사용, UUID 미검증, RoomSettings 검증 부재 |
| requirement | HIGH | 스터드 베팅 순서 오류, getAnte() 미사용, resolveHand 카드 불일치 |
| testing | HIGH | TournamentMode·HallOfFameService·PlayerService 테스트 없음 |
| maintainability | HIGH | resolveHand 3중 복제, 중복 분기, 메서드명 불일치 |
| architecture | HIGH | resolveHand 3중 복제, 엔진 상태 혼재, God Object, 순환 의존성 |
| database | MEDIUM | 인덱스 누락, 트랜잭션 미적용, TOCTOU |
| performance | MEDIUM | 매 액션마다 전체 상태 JSON 직렬화 |
| concurrency | MEDIUM | activeGames 인메모리 의존, finishingRooms 취약점 |
| side_effect | MEDIUM | startGame 무음 덮어쓰기, 공유 엔진 인스턴스 |
| scope | MEDIUM | getAnte() 미사용, 합산 기반 순서 결정 |
| dependency | MEDIUM | 순환 의존성, uuid 엔진 직접 참조 |
| api_contract | MEDIUM | 응답 형식 비일관성, API 버전 관리 부재 |
| documentation | LOW | 핵심 인터페이스 JSDoc 없음 |

## 권장 조치사항

1. **[즉시]** 카드 셔플 `crypto.randomInt()`로 교체
2. **[즉시]** `RoomSettingsDto` 범위 검증, `NicknameDto` 생성, 쿠키 UUID 형식 검증
3. **[즉시]** 7-카드 스터드 베팅 순서 수정 (`handEvaluator.evaluate()` 사용)
4. **[단기]** `resolveHand` 중복 제거 (`BasePokerEngine` 추출)
5. **[단기]** `TournamentMode`, `HallOfFameService`, `PlayerService` 테스트 작성
6. **[단기]** 엔진 `Deck` 필드 제거 → stateless 전환
7. **[단기]** `leaveRoom` 단일 트랜잭션 적용, DB 인덱스 추가
8. **[중기]** Five Card Draw `discardPile` 전체 추적 구현
9. **[중기]** `GameService` SRP 분리
10. **[중기]** 핵심 인터페이스 JSDoc 작성