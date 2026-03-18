## 의존성 코드 리뷰

### 발견사항

- **[WARNING]** AiModule ↔ GameModule 간 순환 의존성 위험
  - 위치: `backend/src/ai/ai-player.service.ts:2`, `backend/src/game/game.service.ts:10`
  - 상세: `AiPlayerService`가 `HandEvaluator`를 `../game/engine/hand-evaluator.js`에서 직접 import하고, `GameService`도 `isAiPlayer`를 `../ai/ai-names.js`에서 import함. 파일 레벨 순환 참조는 현재 런타임 오류를 발생시키지 않지만, NestJS DI 관점에서 ai 모듈과 game 모듈 간 양방향 의존성이 형성됨. NestJS 모듈 레벨에서 `AiPlayerModule`이 `GameModule`을 import하지 않아 현재는 작동하지만, 구조적 취약점으로 유지보수 중 실수할 여지가 있음.
  - 제안: `HandEvaluator`를 별도 `shared` 모듈로 분리하거나, `AiPlayerService`에 주입받는 방식으로 변경하여 단방향 의존성을 유지

- **[WARNING]** `AI_UUID_PREFIX` 상수와 SQL 하드코딩 불일치
  - 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts:56`, `backend/src/ai/ai-names.ts:9`
  - 상세: `ai-names.ts`에 `AI_UUID_PREFIX = 'ai-player-'` 상수가 정의되어 있으나, `hall-of-fame.service.ts`의 SQL 조건에서는 `"gp.playerUuid NOT LIKE 'ai-%'"` 형식의 하드코딩 문자열을 사용. prefix가 변경되면 SQL 필터가 자동으로 업데이트되지 않아 AI 플레이어가 랭킹에 포함될 수 있음.
  - 제안: `AI_UUID_PREFIX`를 import하여 동적으로 조건 생성: `.andWhere(\`gp.playerUuid NOT LIKE '${AI_UUID_PREFIX}%'\`)`

- **[INFO]** `AiPlayerService`가 `HandEvaluator`를 직접 인스턴스화
  - 위치: `backend/src/ai/ai-player.service.ts:23`
  - 상세: `private handEvaluator = new HandEvaluator()`로 직접 인스턴스를 생성. NestJS의 DI 컨테이너를 통해 주입받지 않아 테스트 시 mocking이 어렵고, `HandEvaluator`가 상태를 가지거나 DB 연결이 필요해질 경우 문제 발생 가능성 있음. 현재 `HandEvaluator`가 stateless하므로 동작에는 문제 없음.
  - 제안: `HandEvaluator`를 `@Injectable()`로 선언하고 NestJS DI로 주입받도록 변경 고려

- **[INFO]** 새 외부 패키지 없음, 내부 모듈만 추가
  - 위치: `backend/src/room/room.module.ts`
  - 상세: `AiPlayerModule` 추가는 내부 모듈이며, `AiPlayerService`의 의존성도 전부 기존 내부 파일(`HandEvaluator`, `RANK_VALUES`, `AI_NAMES`). 외부 패키지 추가 없음.

- **[INFO]** `aiPlayersMap`의 메모리 누수 가능성
  - 위치: `backend/src/room/room.gateway.ts:45`
  - 상세: `aiPlayersMap`은 게임 종료(`GAME_ENDED`) 시 삭제되지만, 연결 끊김이나 예외 상황에서 정리되지 않을 수 있음. 직접적인 의존성 문제는 아니나 내부 상태 관리 이슈.
  - 제안: `handleDisconnect` 등 cleanup 경로에서도 `aiPlayersMap.delete(roomId)` 호출 추가

---

### 요약

이번 변경에서 새로운 외부 패키지는 추가되지 않았으며, 모든 새 의존성은 프로젝트 내부 모듈 간 참조입니다. 가장 주목할 점은 `GameService`(game 모듈)가 `ai-names.ts`를 import하고, `AiPlayerService`(ai 모듈)가 `HandEvaluator`(game 모듈)를 직접 import하는 양방향 참조 구조입니다. 현재 NestJS 모듈 선언 수준에서 `forwardRef` 없이 동작하므로 단기적 문제는 없으나, 장기적으로 `HandEvaluator`를 shared 유틸리티로 분리하는 것이 아키텍처 건전성을 위해 권장됩니다. 또한 `AI_UUID_PREFIX` 상수가 SQL 필터에 반영되지 않는 동기화 문제는 실제 버그로 이어질 수 있으므로 조치가 필요합니다.

### 위험도

**LOW**