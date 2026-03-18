# 코드 리뷰 조치 내용

## Critical 조치

### 1. `processAiTurnsOrNotify` 에러 처리 부재
- **조치**: 메서드 전체를 try-catch-finally로 래핑
- **에러 발생 시**: `WS_EVENTS.ERROR` 이벤트를 클라이언트에 전송
- **파일**: `room.gateway.ts`

### 2. AI UUID 스푸핑 방지
- **조치**: `game.service.ts`의 `handleAction()` 진입부에 `isAiPlayer(playerUuid)` 검사 추가
- **외부 클라이언트가 AI UUID로 액션을 전송하면 즉시 예외 처리**
- **내부 AI 루프에서는 `fromAiLoop = true` 파라미터로 우회**
- **파일**: `game.service.ts`

## Warning 조치

### 1. `while(true)` 무한 루프 위험
- **조치**: `MAX_AI_TURNS = 100` 가드 추가, 초과 시 루프 종료
- **파일**: `room.gateway.ts`

### 2. 동시 실행 방어
- **조치**: `processingAiTurns = new Set<string>()` 가드 도입
- **동일 roomId에 대해 AI 루프가 이미 실행 중이면 중복 실행 방지**
- **파일**: `room.gateway.ts`

### 3. `AI_UUID_PREFIX` SQL 동기화
- **조치**: `hall-of-fame.service.ts`에서 하드코딩 `'ai-%'` 대신 `AI_UUID_PREFIX` 상수를 import하여 파라미터 바인딩 사용
- **파일**: `hall-of-fame.service.ts`

### 4. `finishGame`/`getGameResult` 로직 중복
- **조치**: `resolvePlayerResult()` private 헬퍼 메서드로 추출하여 두 메서드에서 공유
- **파일**: `game.service.ts`

### 5. AI 플레이어 placement 번호 불연속
- **조치**: `finishGame`에서 전체 정렬 후 overall placement를 유지하면서 AI만 필터링하여 DB에 저장
- **파일**: `game.service.ts`

### 6. 확률적 테스트 불안정
- **조치**: `jest.spyOn(Math, 'random').mockReturnValue(0.5)`로 난수를 고정하여 결정적 테스트로 변경
- **파일**: `ai-player.service.spec.ts`

### 7. `checkAllReady` 변경 이유 문서화
- **조치**: `// 1명이라도 준비되면 AI가 나머지 좌석을 채움` 주석 추가
- **파일**: `room.service.ts`

## 미조치 (INFO 수준 - 향후 개선 사항)

- `scoreMap` 클래스 레벨 상수 추출 (성능 최적화 - 현재 영향 미미)
- `decideAction`의 `variant` 파라미터 중복 제거 (리팩토링)
- AI UUID 방별 고유화 (다중 방 동시 진행 시 - 현재 UUID가 방 단위로 격리되어 문제 없음)
- `HandEvaluator` DI 주입 전환 (아키텍처 개선)
- Gateway 책임 분리 (대규모 리팩토링)
