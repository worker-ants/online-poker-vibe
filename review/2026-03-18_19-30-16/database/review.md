### 발견사항

- **[CRITICAL]** 트랜잭션 없는 다단계 삭제 로직
  - 위치: `room.service.ts` `leaveRoom()` 메서드 (180~197행)
  - 상세: `roomPlayerRepository.remove()` → `participantRepository.delete()` → `gameRepository.remove()` → `roomRepository.remove()` 순서로 4개의 DB 작업이 수행되지만 트랜잭션으로 묶여 있지 않습니다. 중간 단계에서 실패하면 participants는 삭제되었으나 games가 남거나, games는 삭제되었으나 room이 남는 등 데이터 불일치 상태가 됩니다.
  - 제안: `createQueryRunner()`로 트랜잭션 블록으로 감싸거나, CASCADE가 정상 작동한다면 단순히 `roomRepository.remove(room)`만 호출

- **[WARNING]** CASCADE와 수동 삭제의 중복/모순
  - 위치: `game-participant.entity.ts`, `game.entity.ts`, `room.service.ts`
  - 상세: 엔티티에 `onDelete: 'CASCADE'`를 추가했으나 `room.service.ts`에서는 여전히 participants와 games를 수동으로 삭제합니다. CASCADE가 DB 레벨에서 실제로 적용된다면 수동 삭제는 불필요합니다. CASCADE가 적용되지 않는다면(예: 마이그레이션 미실행) 수동 삭제가 필요하지만, 그렇다면 원래 오류의 원인인 FOREIGN KEY constraint 문제도 해결되지 않습니다. 두 방법 중 하나를 선택해야 합니다.
  - 제안: SQLite에서 `synchronize: true`가 활성화된 경우 CASCADE가 반영되는지 확인 후, 반영된다면 수동 삭제 코드 제거

- **[WARNING]** SQLite 외래키 비활성화 가능성
  - 위치: DB 설정 레벨
  - 상세: SQLite는 기본적으로 외래키 제약을 비활성화(`PRAGMA foreign_keys = OFF`)합니다. TypeORM이 SQLite 연결 시 `foreign_keys = ON`을 설정하지 않으면 `onDelete: 'CASCADE'`가 선언되어 있어도 DB 레벨에서 무시됩니다. 이것이 원래 `FOREIGN KEY constraint failed` 오류의 근본 원인일 수 있습니다.
  - 제안: TypeORM DataSource 설정에 `extra: { pragma: ["PRAGMA foreign_keys = ON;"] }` 또는 연결 후 `PRAGMA foreign_keys = ON` 실행 추가

- **[WARNING]** 스키마 변경의 마이그레이션 안전성
  - 위치: `game-participant.entity.ts`, `game.entity.ts`
  - 상세: SQLite는 기존 외래키 제약에 CASCADE를 추가하는 `ALTER TABLE ... MODIFY CONSTRAINT` 를 지원하지 않습니다. TypeORM `synchronize: true`는 테이블 재생성으로 처리하므로 기존 데이터가 유실될 수 있습니다. 프로덕션 데이터가 없는 개발 단계라면 허용 가능하지만, 명시적 마이그레이션이 없는 상태입니다.
  - 제안: `synchronize: false`로 전환하고 명시적 마이그레이션 파일 사용, 또는 개발 환경임을 문서화

- **[WARNING]** 동시성 레이스 컨디션
  - 위치: `room.service.ts` `leaveRoom()` (174~197행)
  - 상세: `roomPlayer` 삭제 후 `roomPlayers.length === 0` 체크까지 사이에 다른 플레이어가 동시에 퇴장할 경우, 두 요청 모두 `length === 0`으로 판단하여 중복 삭제를 시도할 수 있습니다.
  - 제안: 트랜잭션 + 비관적 락(`SELECT ... FOR UPDATE`) 적용, 또는 원자적 카운트 조회로 처리

- **[INFO]** `GameParticipant` 조회 미사용
  - 위치: `room.service.ts`, `room.module.ts`
  - 상세: `participantRepository`가 주입되고 삭제용으로만 사용되나, CASCADE가 정상 작동한다면 이 레포지토리 자체가 `RoomModule`에 불필요합니다. Game과 GameParticipant를 `RoomModule`에 등록하는 것은 모듈 경계를 흐립니다.
  - 제안: CASCADE 확인 후 불필요한 레포지토리 주입 제거, 또는 Game 삭제 로직을 `GameService`로 이동하고 해당 서비스를 호출하는 방식으로 모듈 책임 분리

---

### 요약

이번 변경의 핵심 목적은 Room 삭제 시 관련 Game/GameParticipant 레코드의 FOREIGN KEY 오류를 해결하는 것으로, `onDelete: 'CASCADE'` 추가와 수동 삭제 로직 추가라는 두 가지 접근이 동시에 적용되었습니다. 그러나 SQLite의 외래키 기본 비활성화 특성을 고려하지 않아 CASCADE가 실제로 작동하는지 불확실하고, 두 방법의 중복으로 코드 의도가 모호합니다. 가장 중요한 문제는 다단계 삭제 로직이 트랜잭션으로 보호되지 않아 부분 실패 시 데이터 정합성이 깨질 수 있다는 점입니다.

### 위험도
**HIGH**