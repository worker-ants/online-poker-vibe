### 발견사항

- **[WARNING]** 명예의 전당 집계 쿼리 성능 문제
  - 위치: `spec/08-hall-of-fame.md` — SQL 집계 쿼리
  - 상세: 전체 `game_participant` 테이블을 매 요청마다 GROUP BY로 집계합니다. 데이터가 쌓일수록 응답 지연이 선형으로 증가합니다. ORDER BY의 `winRate`는 계산식이므로 인덱스를 활용할 수 없습니다.
  - 제안: `GameParticipant`에 집계 컬럼(wins, losses, draws, abandonments)을 비정규화하여 `Player` 테이블에 캐싱하거나, 별도의 `PlayerStats` 테이블을 두고 게임 결과 저장 시 증분 업데이트 방식을 사용하세요. 현재 페이지네이션이 있어도 집계 자체는 전체 테이블 스캔입니다.

- **[WARNING]** 플레이어 전적 히스토리 무제한 조회
  - 위치: `frontend/app/hall-of-fame/page.tsx:47` — `GET /hall-of-fame/${uuid}/history`
  - 상세: 플레이어 전적 조회 API에 페이지네이션이 없습니다. 활동이 많은 플레이어의 전체 히스토리를 한 번에 로딩하면 대용량 데이터가 메모리에 올라올 수 있습니다.
  - 제안: `/hall-of-fame/${uuid}/history?page=1&limit=20` 방식으로 페이지네이션을 적용하고, 모달 내 무한 스크롤 또는 페이지 버튼을 추가하세요.

- **[WARNING]** Room.settings JSON 컬럼 설계
  - 위치: `spec/02-database.md` — Room 테이블 settings 컬럼
  - 상세: `blindSchedule` 배열을 포함한 설정 전체를 JSON TEXT로 저장합니다. 특정 설정값(예: smallBlind 기준 조회)으로 필터링이 필요해질 경우 전체 스캔이 불가피합니다. SQLite는 JSON 함수를 지원하나 인덱스 활용이 불가합니다.
  - 제안: 현재 요구사항(필터링 없음)에서는 허용 가능한 트레이드오프입니다. 단, `smallBlind`/`bigBlind`는 별도 컬럼으로 분리하면 추후 기능 확장 시 유리합니다.

- **[INFO]** OFFSET 기반 페이지네이션
  - 위치: `spec/08-hall-of-fame.md` — 페이지네이션 API
  - 상세: 전형적인 `LIMIT/OFFSET` 방식을 사용할 것으로 보입니다. 페이지가 깊어질수록(예: page 100) 앞 레코드를 건너뛰는 비용이 증가합니다.
  - 제안: 명예의 전당 특성상 순위 기준이 변동될 수 있어 커서 기반 페이지네이션 도입이 어렵습니다. 집계 결과를 캐싱하면 이 문제를 함께 해결할 수 있습니다.

- **[INFO]** GameParticipant 인덱스 충분성
  - 위치: `spec/02-database.md` — 인덱스 목록
  - 상세: `UNIQUE(gameId, playerUuid)` 복합 인덱스가 존재하며, `playerUuid` 단독 인덱스도 명시되어 있습니다. 집계 쿼리의 JOIN 조건(`gp.gameId = g.id`, `gp.playerUuid = p.uuid`)을 커버합니다. 적절한 설계입니다.

---

### 요약

리뷰 대상은 대부분 프론트엔드 컴포넌트와 스펙 문서이며, 실제 DB 레이어 코드는 포함되지 않았습니다. 데이터베이스 관점의 주요 위험은 두 가지입니다: 첫째, 명예의 전당 순위 집계가 매 요청마다 전체 테이블을 스캔하는 구조로, 데이터 증가 시 성능 병목이 예상됩니다. 둘째, 플레이어 전적 히스토리에 페이지네이션이 없어 대용량 응답 가능성이 있습니다. 스키마 설계 자체는 정규화가 적절하고 핵심 인덱스도 명시되어 있으나, 집계 성능을 위한 `PlayerStats` 캐싱 테이블 도입을 강력히 권장합니다.

### 위험도
**MEDIUM**