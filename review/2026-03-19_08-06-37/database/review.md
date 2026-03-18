### 발견사항

- **[WARNING]** `roomId` 컬럼 nullable 변경 — 마이그레이션 안전성
  - 위치: `game.entity.ts` — `roomId` 컬럼 정의
  - 상세: NOT NULL 컬럼을 nullable로 변경하는 스키마 변경이 발생합니다. SQLite에서 TypeORM은 컬럼 제약 변경 시 테이블을 재생성(`DROP` + `CREATE`)하는 방식을 사용합니다. `synchronize: true` 환경에서는 데이터 유실 위험이 없지만, `migration`을 사용하는 환경에서는 명시적 마이그레이션이 필요합니다. 또한 `onDelete: 'CASCADE'` → `onDelete: 'SET NULL'` 변경도 외래키 제약 조건 변경으로 SQLite에서 테이블 재생성을 유발합니다.
  - 제안: 마이그레이션 스크립트를 작성하여 변경을 명시적으로 관리하거나, 현재 `synchronize: true` 설정이 유지되는지 확인하세요. 프로덕션 배포 전에 반드시 마이그레이션 경로를 검토하세요.

- **[INFO]** 복합 쿼리에 단일 인덱스만 사용
  - 위치: `game.service.ts` — `deleteByRoom` 메서드 / `game.entity.ts` — 인덱스 정의
  - 상세: `deleteByRoom`의 조회 쿼리 `find({ where: { roomId, status: 'in-progress' } })`는 `roomId`와 `status` 두 컬럼을 동시에 필터링하지만, 각각 별도의 단일 인덱스(`@Index()`)만 존재합니다. SQLite는 이 경우 하나의 인덱스만 사용하고 나머지는 필터링으로 처리합니다.
  - 제안: 조회 패턴에 맞는 복합 인덱스 추가를 고려하세요: `@Index(['roomId', 'status'])`. 다만 현재 데이터 규모에서는 성능 이슈가 없을 수 있어 선택적 개선 사항입니다.

- **[INFO]** NULL이 된 `roomId`를 가진 게임 레코드 쿼리 처리
  - 위치: `game.service.ts` — `deleteByRoom` 메서드
  - 상세: Room 삭제 시 `SET NULL`로 `roomId`가 null이 된 게임 레코드가 생깁니다. `deleteByRoom`은 `where: { roomId, status: 'in-progress' }`로 쿼리하므로, Room이 이미 삭제되어 `roomId`가 null인 진행 중 게임은 조회 및 정리가 불가합니다.
  - 제안: Room 삭제 전에 반드시 `deleteByRoom`이 호출되는 순서가 보장되는지 확인하세요. 또는 `onModuleInit`의 abandoned 처리에서 `roomId IS NULL AND status = 'in-progress'` 케이스도 처리하는 것을 고려하세요.

- **[INFO]** 트랜잭션 내 수동 자식 레코드 삭제 — CASCADE 미활용
  - 위치: `game.service.ts` — `deleteByRoom` 트랜잭션 블록
  - 상세: `GameParticipant`를 먼저 수동 삭제한 후 `Game`을 삭제합니다. `GameParticipant → Game` 관계에 `onDelete: 'CASCADE'`가 설정되어 있다면, Game 삭제 시 자동으로 처리될 수 있습니다.
  - 제안: 현재 구현은 명시적이고 안전하므로 기능상 문제는 없습니다. `GameParticipant` 엔티티의 FK 설정을 확인하여 중복 처리가 없는지 검토하세요.

---

### 요약

이번 변경의 핵심은 게임 이력을 명예의 전당에 보존하기 위해 `Room` 삭제 시 게임 레코드를 같이 삭제하지 않고 `roomId`를 NULL로 유지하는 `SET NULL` 전략으로의 전환입니다. 설계 의도는 명확하고 `deleteByRoom`에서 진행 중 게임만 정리하는 로직도 적절합니다. 주요 위험 요소는 SQLite에서의 스키마 변경(NOT NULL → nullable, CASCADE → SET NULL)이 테이블 재생성을 유발할 수 있다는 점으로, 현재 개발 환경에서는 `synchronize: true`로 관리되겠지만 프로덕션 전환 시 주의가 필요합니다. 트랜잭션 처리, 오류 롤백, 커넥션 해제(finally 블록)는 모두 올바르게 구현되어 있습니다.

### 위험도
**MEDIUM** (스키마 마이그레이션 안전성 관련 — 개발 환경에서는 LOW)