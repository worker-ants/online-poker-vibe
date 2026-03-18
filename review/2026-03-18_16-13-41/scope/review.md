## Scope Code Review

### 발견사항

- **[WARNING]** `room.controller.ts`에서 `PlayerUuid` 데코레이터를 사용하지 않음
  - 위치: `backend/src/room/room.controller.ts:22`
  - 상세: 동일 PR에서 `player-uuid.decorator.ts`를 추가했음에도 컨트롤러에서는 `(req as any).cookies?.player_uuid`로 직접 접근 중. 데코레이터 도입 목적이 무색해짐
  - 제안: `@PlayerUuid() uuid: string | undefined`로 교체

- **[WARNING]** `pot-calculator.ts`에 사용되지 않는 변수 존재
  - 위치: `backend/src/game/engine/pot-calculator.ts:46–50`
  - 상세: `partialContributors` 변수가 선언되었으나 실제로 사용되지 않음. 팟 계산 로직에서 의도된 처리가 누락되었을 가능성이 있음
  - 제안: 변수 제거 또는 실제 팟 계산 로직에 반영

- **[WARNING]** `player.service.ts`의 `createPlayer()` 메서드가 데드 코드
  - 위치: `backend/src/player/player.service.ts:31–35`
  - 상세: 컨트롤러에서는 UUID를 직접 생성하여 `findOrCreate(uuid)`를 호출하는 방식을 사용. `createPlayer()`는 어디서도 호출되지 않음
  - 제안: 제거하거나 컨트롤러의 UUID 생성 책임을 서비스로 이전

- **[WARNING]** `database.module.ts`에서 `synchronize: true` 사용
  - 위치: `backend/src/database/database.module.ts:11`
  - 상세: 프로덕션 환경에서 데이터 손실 위험이 있는 설정. 환경 변수로 분기하지 않고 하드코딩됨
  - 제안: `synchronize: process.env.NODE_ENV !== 'production'`으로 변경

- **[WARNING]** `room.controller.ts`에서 불필요한 네임스페이스 임포트
  - 위치: `backend/src/room/room.controller.ts:3`
  - 상세: `import * as express from 'express'`를 사용하지만 실제로는 `express.Request` 타입 참조에만 사용. 다른 컨트롤러들은 `import type { Request } from 'express'`를 사용함
  - 제안: `import type { Request } from 'express'`로 통일

- **[INFO]** `game.service.ts`에서 `any` 타입 과다 사용
  - 위치: `backend/src/game/game.service.ts:100, 159, 162, 173` 등
  - 상세: `getPublicState()`, `getActionRequired()`, `getGameResult()` 등의 반환 타입이 `any`. 공통 타입 파일을 이미 정의했으므로 활용이 가능함
  - 제안: 반환 타입에 대한 인터페이스 정의 또는 기존 타입 활용

- **[INFO]** `hall-of-fame.service.ts`에서 N+1 쿼리 패턴
  - 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts:121–145`
  - 상세: `getPlayerHistory()`에서 각 게임마다 `participantRepository.find()`를 개별 호출. 게임 수가 많아질 경우 성능 문제 유발
  - 제안: `gameId IN (...)` 형태의 단일 쿼리로 개선

- **[INFO]** `betting-round.ts`의 `findNextActivePlayer()`에서 루프 종료 조건 미흡
  - 위치: `backend/src/game/engine/betting-round.ts:221`
  - 상세: 활성 플레이어가 없을 경우 `fromIndex`를 그대로 반환. 호출자가 이 케이스를 처리하지 않으면 무한 루프 위험
  - 제안: 명시적 반환값(-1 또는 nullable) 및 호출부에서의 처리 추가

---

### 요약

이번 변경은 `turn 1` 온라인 포커 게임의 초기 구현으로, 범위 이탈 없이 스펙에 명시된 백엔드(플레이어, 방, 게임 엔진, 명예의 전당)와 프론트엔드 게임 페이지 전반을 구현하고 있습니다. 보일러플레이트 삭제, 공통 타입 정의, 엔진 로직, 데이터베이스 설정 모두 의도된 범위 내에 있습니다. 다만 같은 PR 내에서 추가된 `PlayerUuid` 데코레이터를 컨트롤러에서 사용하지 않는 일관성 문제, 미사용 변수(`partialContributors`), 데드 코드(`createPlayer`), `synchronize: true` 설정이 품질 리스크로 확인되었습니다.

### 위험도

**MEDIUM**