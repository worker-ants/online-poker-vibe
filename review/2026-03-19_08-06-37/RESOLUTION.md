# Code Review Resolution

## 조치 완료 항목

### CRITICAL

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | DB 마이그레이션 파일 누락 | 현재 프로젝트는 `synchronize: true` (non-production)로 운영되므로 자동 스키마 동기화 적용. 별도 마이그레이션 불필요 |

### WARNING

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `deleteByRoom` TOCTOU 경쟁 조건 | `find` 쿼리를 트랜잭션 내부(`queryRunner.manager.find`)로 이동하여 해결 |
| 2 | `deleteByRoom` 후 `activeGames` 인메모리 미정리 | 메서드 끝에 `this.activeGames.delete(roomId)` 추가 |
| 3 | `room: Room` 타입 미수정 | `room: Room \| null` 및 `@ManyToOne({ nullable: true })` 명시 |
| 4 | Room 삭제 순서 문제 | 기존 코드에서 이미 `deleteInProgressGamesByRoom` → Room 삭제 순서로 실행됨. SET NULL은 Room 삭제 시에만 적용되므로 정상 동작 |
| 5 | 롤백 경로 테스트 누락 | 에러 시 `rollbackTransaction` 및 `release` 호출 검증 테스트 추가 |
| 6 | 트랜잭션 생명주기 미검증 | `commitTransaction`, `release` 호출 검증 추가 |
| 7 | `GameParticipant` 삭제 대상 미검증 | `from(GameParticipant)` 및 `where` 조건 검증 추가 |
| 8 | 메서드명 불일치 | `deleteByRoom` → `deleteInProgressGamesByRoom`으로 변경 |
| 9 | `roomId` null 전파 | `roomId`는 게임 진행 중에는 항상 non-null이며, Room 삭제 후에만 null로 변경됨. Hall of Fame 쿼리는 roomId를 사용하지 않으므로 영향 없음 |
| 10 | Mock 중복 | `mockQueryRunnerForDelete`에 `find` 메서드 추가하여 역할 분리 유지 |
| 11 | CLAUDE.md 범위 이탈 | CLAUDE.md 변경은 별도 작업 |
| 12 | API 계약 변경 | `roomId`는 외부 API(REST/WebSocket)로 노출되지 않음. Game 엔티티는 내부 DB 모델이므로 클라이언트에 영향 없음 |

### INFO

| # | 발견사항 | 조치 |
|---|----------|------|
| 1-12 | 성능/보안/문서 관련 | 현재 버그 수정 범위를 초과하므로 별도 개선 검토 대상 |
