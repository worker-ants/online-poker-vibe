# 코드 리뷰 조치 내용 (Batch 1 — Backend)

## Critical 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | `handleAction()` 동시성 경쟁 조건 | `finishingRooms` Set 추가, 핸드 종료 처리 중 중복 진입 차단 | **완료** |
| 2 | `joinRoom()` TOCTOU 경쟁 | `roomPlayerRepository.save()` try-catch로 `QueryFailedError` → `BadRequestException` 변환 | **완료** |
| 3 | `PotCalculator` 미사용 `partialContributors` 변수 | 미사용 변수 제거 (실제 팟 계산은 `Math.min(Math.max(...))` 로 정상 동작 중) | **완료** |
| 4 | 세븐카드 스터드 앤티/currentBet 충돌 | `player.currentBet = anteAmount` 제거 — 앤티는 팟에만 기여하고 베팅 라운드 currentBet에 영향 안줌 | **완료** |
| 5 | `startNextHand()` 자동 호출 경로 없음 | 이미 `room.gateway.ts:284`에서 `setTimeout(() => this.startNextHand(roomId), 3000)` 구현됨 — 리뷰 시점 누락된 것으로 판단 | **해당 없음** |
| 6 | `PotCalculator` 테스트 전무 | 향후 TDD 사이클에서 별도 작성 예정 | **보류** |
| 7 | `GameService` 테스트 전무 | 향후 TDD 사이클에서 별도 작성 예정 | **보류** |
| 8 | `RoomService`/`RoomGateway` 테스트 전무 | 향후 TDD 사이클에서 별도 작성 예정 | **보류** |
| 9 | API 에러 응답 형식 불일치 | `RoomController`에서 `{ success: false }` 대신 `throw new UnauthorizedException()` 사용, `@PlayerUuid()` 데코레이터 적용 | **완료** |

## Warning 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | `synchronize: true` 하드코딩 | `process.env.NODE_ENV !== 'production'` 조건 분기 적용 | **완료** |
| 2 | `getPlayerHistory()` N+1 쿼리 | `In()` 배치 조회 + Map 그룹핑으로 단일 쿼리화 | **완료** |
| 3 | 방 생성 시 트랜잭션 미사용 | `queryRunner.startTransaction()` 원자적 처리 적용 | **완료** |
| 4 | `finishGame()` 트랜잭션 미사용 | `queryRunner` 트랜잭션으로 묶음 | **완료** |
| 5 | DB 인덱스 누락 | 향후 마이그레이션 시 추가 예정 | **보류** |
| 6 | 쿠키 서명 없음 | 보안 강화 작업 시 일괄 적용 예정 | **보류** |
| 7 | WebSocket UUID 신뢰 | 현재 `socketPlayerMap`에서 서버 사이드 매핑 사용 중이므로 클라이언트 payload UUID는 무시됨 — 추가 검증 보류 | **보류** |
| 8 | `Math.random()` 셔플 | `crypto.randomInt()` 으로 교체 | **완료** |
| 9 | 홀 카드 노출 위험 | `sendPrivateStates()`에서 `playerSocketMap` 기반으로 개별 소켓에만 emit 중 — 정상 동작 확인 | **해당 없음** |
| 10 | `setNickname()` TOCTOU | `save()` try-catch에서 constraint 위반 → `BadRequestException` 변환 | **완료** |
| 11 | `toggleReady()` 중복 요청 | 현재 영향도 낮음 — 향후 개선 예정 | **보류** |
| 12 | `findOrCreate()` PK 충돌 | try-catch + 재조회 패턴 적용 | **완료** |
| 13 | 순환 의존성 `forwardRef` | 아키텍처 개선 시 일괄 처리 예정 | **보류** |
| 14 | `NicknameRequiredGuard` 레이어 역전 | 아키텍처 개선 시 일괄 처리 예정 | **보류** |
| 15 | `GameService` SRP 위반 | 아키텍처 개선 시 일괄 처리 예정 | **보류** |
| 16 | 서버 재시작 시 인메모리 상태 손실 | `OnModuleInit`에서 `in-progress` → `abandoned` 자동 업데이트 로직 추가 | **완료** |
| 17 | `@PlayerUuid()` 데코레이터 미사용 | `RoomController`에서 데코레이터 사용으로 변경 | **완료** |
| 18 | `PlayerController` `@Res()` 직접 사용 | `@Res({ passthrough: true })` + 헬퍼 메서드 추출로 개선 | **완료** |
| 19 | `GameService` `any` 반환 타입 | 향후 타입 정의 시 개선 예정 | **보류** |
| 20 | `PlayerController` 쿠키 설정 중복 | `getOrCreateUuid()` 헬퍼 메서드 추출 | **완료** |
| 21 | `findNextActivePlayer()` 폴드/올인 플레이어 반환 | 활성 플레이어 없을 시 `-1` 반환으로 변경 | **완료** |
| 22 | `SetNicknameDto` 미사용 | 향후 ValidationPipe 도입 시 적용 예정 | **보류** |
| 23 | Hall of Fame 인증 없음 | 공개 데이터로 현재 의도된 동작 — `ParseUUIDPipe` 추가로 UUID 형식 검증 | **완료** |
| 24 | URL 네이밍 불일치 | 기존 클라이언트 호환성 유지 위해 보류 | **보류** |
| 25-26 | FiveCardDraw/SevenCardStud 테스트 전무 | 향후 TDD 사이클에서 작성 예정 | **보류** |
| 27 | `BettingRound` 테스트 상태 오염 | 향후 테스트 개선 시 적용 예정 | **보류** |
| 28 | `socket.io` 버전 불일치 위험 | 향후 의존성 정리 시 적용 예정 | **보류** |
| 29 | `settings` JSON 문자열 타입 안전성 | 향후 타입 안전성 개선 시 적용 예정 | **보류** |
| 30 | `finishGame()` draw 처리 없음 | 동일 칩 보유 시 `draw` 결과 처리 로직 추가 | **완료** |

## Info 항목

미사용 import 제거(`uuidv4`), 데드 코드 제거(`createPlayer()`), `getPrivateStates()` 배열 복사 적용 등 코드 품질 항목 조치 완료. 나머지 문서화, 아키텍처 개선 항목은 향후 개선 계획에 포함.
