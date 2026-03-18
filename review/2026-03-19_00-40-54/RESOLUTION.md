# Code Review Resolution (Batch 2)

## Critical 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|---------|----------|------|
| 1 | `Math.random()` 카드 셔플 | 확인 결과 이미 `crypto.randomInt()` 사용 중 (오탐) | 확인 완료 |
| 2 | `resolveHand` 3중 복제 | `resolve-hand.ts` 공유 유틸리티 함수 추출. `getEvalCards` 콜백으로 variant별 카드 선택 로직 분리 | 완료 |
| 3 | Seven Card Stud 베팅 순서 | `findHighestVisibleHand()` 를 `scoreVisibleCards()`로 교체. 페어/트립스 등 실제 핸드 랭크 비교 | 완료 |
| 4 | TournamentMode 테스트 없음 | 별도 테스트 작성 태스크로 분리 | 보류 |
| 5 | HallOfFameService 테스트 없음 | 별도 테스트 작성 태스크로 분리 | 보류 |
| 6 | 엔진 Deck 인스턴스 필드 | 세 엔진 모두 `private deck` 필드 제거, `startHand` 내 지역 변수로 전환 (stateless) | 완료 |

## Warning 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|---------|----------|------|
| 1 | 쿠키 UUID 형식 미검증 | `player.controller.ts`, `room.gateway.ts`에 `uuid.validate()` 검증 추가. 유효하지 않은 UUID는 신규 생성 또는 연결 거부 | 완료 |
| 2 | RoomSettings 검증 부재 | `RoomSettingsDto` class-validator 데코레이터 추가. `room.service.ts`에 `bigBlind >= smallBlind` 교차 검증 | 완료 |
| 3 | WebSocket playerUuid 신뢰 | 확인 결과 이미 소켓 handshake 쿠키에서 UUID 추출 (페이로드 미신뢰). UUID 형식 검증 추가로 강화 | 완료 |
| 4 | Rate Limiting | 중기 과제 (`@nestjs/throttler` 도입) | 보류 |
| 5 | GameService God Object | 아키텍처 리팩토링 범위 - 별도 태스크 | 보류 |
| 6 | 순환 의존성 | `forwardRef`로 해결 중. 구조적 분리는 중기 과제 | 보류 |
| 7 | `getAnte()` 미사용 | 인터페이스 정합성 확인 후 별도 조치 | 보류 |
| 8 | Texas Hold'em resolveHand 카드 | 공유 resolveHand에서 `[...player.holeCards, ...s.communityCards]`로 전체 카드 전달 | 완료 |
| 9 | Five Card Draw 덱 재활용 | 별도 태스크로 분리 (discardPile 전체 추적 구현 필요) | 보류 |
| 10 | leaveRoom 트랜잭션 | QueryRunner 트랜잭션으로 래핑 완료 | 완료 |
| 11 | DB 인덱스 누락 | player.entity(uuid), game.entity(roomId, status), room.entity(status), game-participant.entity(playerUuid)에 `@Index()` 추가 | 완료 |
| 12 | 엔진 spec 인스턴스 공유 | 세 엔진 spec 모두 `beforeEach`에서 fresh 인스턴스 생성으로 변경 | 완료 |
| 13 | 테스트 커버리지 | 별도 태스크로 분리 | 보류 |
| 14 | startGame 중복 호출 | 인메모리 `activeGames` 체크 + DB `findOne` 이중 가드 추가 | 완료 |
