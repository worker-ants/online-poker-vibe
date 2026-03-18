### 발견사항

- **[WARNING]** `hall-of-fame.service.ts`의 `playerUuid NOT LIKE 'ai-%'` 필터가 인덱스 활용 불가
  - 위치: `hall-of-fame.service.ts` 53번째 줄, 84번째 줄
  - 상세: `LIKE 'ai-%'` 패턴은 prefix 검색이므로 인덱스를 탈 수 있지만, TypeORM raw query 방식에서는 쿼리 플래너가 해당 컬럼(`playerUuid`)에 인덱스가 있더라도 활용 여부가 불확실합니다. SQLite에서 문자열 `LIKE` 연산은 `PRAGMA case_sensitive_like`가 꺼져 있으면 대소문자 무시로 동작하여 예상치 못한 결과가 생길 수 있습니다.
  - 제안: `NOT LIKE` 대신 `isAiPlayer()` 로직처럼 prefix를 상수로 관리하고, 파라미터 바인딩 사용: `.andWhere("gp.playerUuid NOT LIKE :prefix", { prefix: 'ai-%' })`

- **[WARNING]** `getGameResult()`가 DB 조회 없이 인메모리 상태로만 결과를 구성하여 DB와 불일치 가능
  - 위치: `game.service.ts` `getGameResult()` 메서드
  - 상세: 변경 전에는 `participantRepository`에서 실제 저장된 데이터를 조회했으나, 변경 후에는 인메모리 `active.state`만 참조합니다. `finishGame()`이 트랜잭션 커밋 후 `activeGames.delete()`를 호출하는데, 만약 `getGameResult()`가 `finishGame()` 이후에 호출되면 `active`가 이미 맵에서 제거된 상태일 수 있습니다. 현재 코드에서는 `handleAction()` 내에서 `finishGame()` 후 `getGameResult(active)`를 호출하고 있어 직접 참조이므로 안전하지만, `activeGames.delete()`가 `finishGame()` 내부에서 호출된다는 점에서 타이밍 의존성이 존재합니다.
  - 제안: `getGameResult()`를 `finishGame()` 호출 전에 실행하거나, `finishGame()`에서 상태를 반환하도록 리팩토링

- **[INFO]** `finishGame()`에서 AI 플레이어 skip 시 placement 번호가 연속되지 않을 수 있음
  - 위치: `game.service.ts` `finishGame()` 내 participant 저장 루프
  - 상세: `sortedPlayers` 배열에서 AI 플레이어를 `continue`로 건너뛰지만 `i`는 계속 증가합니다. 예: AI가 1등(i=0)일 경우, 인간 플레이어가 2등(i=1)으로 저장되어야 하는데 placement가 2로 저장됩니다. 실제 상금 배분에는 영향이 없지만 통계 데이터 정합성에 문제가 있습니다.
  - 제안: human player만 필터링한 배열을 별도로 생성한 후 루프 처리

- **[INFO]** `getPlayerHistory()`의 배치 쿼리는 양호하나, `gameIds` 타입 추론 문제
  - 위치: `hall-of-fame.service.ts` 135번째 줄
  - 상세: `filter(Boolean)` 이후 타입이 `(string | undefined)[]`에서 `string[]`으로 좁혀지지 않는 문제를 `as string[]` 캐스팅 제거로 해결했으나, TypeORM `In()` 연산자에 전달 시 타입 오류가 발생할 수 있습니다.
  - 제안: `filter((id): id is string => Boolean(id))` 타입 가드 사용

- **[INFO]** `hall-of-fame.service.ts`의 랭킹 쿼리에 페이지네이션이 있으나 count 쿼리와 본 쿼리가 별도로 실행됨
  - 위치: `hall-of-fame.service.ts` `getRankings()`
  - 상세: count와 data를 각각 별도 쿼리로 실행합니다. 동시 요청이 많을 경우 두 쿼리 사이에 데이터가 변경되면 pagination 메타데이터와 실제 결과가 불일치할 수 있습니다. 현재 트래픽 수준에서는 큰 문제가 아니지만, 향후 개선 포인트입니다.
  - 제안: 단일 트랜잭션 내에서 두 쿼리를 실행하거나 `COUNT(*) OVER()` window function 사용 검토

---

### 요약

이번 변경의 핵심은 AI 플레이어 도입으로, DB 관련 주요 변경사항은 (1) AI 플레이어를 `GameParticipant`에 저장하지 않는 처리와 (2) Hall of Fame 쿼리에서 AI UUID를 필터링하는 것입니다. AI 플레이어 제외 로직 자체는 올바르게 구현되어 있으나, `NOT LIKE 'ai-%'` 필터의 파라미터 바인딩 미사용, placement 번호 불연속 가능성, `getGameResult()`의 인메모리 의존성이 잠재적 문제입니다. 트랜잭션 구조(`finishGame()`)와 배치 N+1 방지(`getPlayerHistory()`)는 기존대로 잘 유지되고 있습니다. 전반적으로 DB 설계 측면에서 큰 위험은 없으나 데이터 정합성과 쿼리 안전성에서 일부 개선이 필요합니다.

### 위험도
**LOW**