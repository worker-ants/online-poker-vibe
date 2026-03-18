### 발견사항

- **[CRITICAL]** RoomService의 단일 책임 원칙(SRP) 위반
  - 위치: `room.service.ts:180-197`
  - 상세: RoomService가 Game, GameParticipant 엔티티를 직접 관리하는 것은 명백한 경계 침범입니다. Room 도메인이 Game 도메인의 내부 구현(participants 삭제 순서)을 알아야 하는 구조는 강한 결합을 유발합니다. 게임 레코드 정리 책임은 GameService에 위임되어야 합니다.
  - 제안: `GameService.deleteByRoom(roomId): Promise<void>` 메서드를 추가하고, RoomService는 해당 메서드만 호출하도록 리팩토링

- **[CRITICAL]** 트랜잭션 누락으로 인한 데이터 정합성 위험
  - 위치: `room.service.ts:181-198`
  - 상세: `participants 삭제 → games 삭제 → room 삭제` 3단계 작업이 단일 트랜잭션 없이 순차 실행됩니다. 중간 단계 실패 시 고아 레코드(orphan records)가 생성됩니다. `createRoom`에서는 트랜잭션을 사용하면서 동등한 위험도의 삭제 작업에는 미적용된 것은 일관성 부재입니다.
  - 제안: `queryRunner`를 활용한 트랜잭션 래핑 필요

- **[WARNING]** DB CASCADE와 애플리케이션 레벨 삭제 로직 이중화
  - 위치: `game.entity.ts`, `game-participant.entity.ts`, `room.service.ts:181-197`
  - 상세: `onDelete: 'CASCADE'`를 DB 레벨에 추가했음에도 RoomService에서 participants를 직접 삭제하는 코드가 존재합니다. Room 삭제 시 DB CASCADE가 `Game → GameParticipant`를 자동 처리하므로, 서비스 레이어의 수동 삭제는 중복입니다. 단, 현재 `room.remove()` 이전에 game을 먼저 삭제하는 방식이므로 실제 CASCADE가 동작할 여지가 없는 상태입니다.
  - 제안: DB CASCADE에 완전히 위임하거나, 애플리케이션 레벨 삭제를 선택하여 한 가지 방식으로 통일

- **[WARNING]** RoomModule의 모듈 경계 침범
  - 위치: `room.module.ts:5-6, 16`
  - 상세: RoomModule이 `Game`, `GameParticipant` 엔티티를 `TypeOrmModule.forFeature()`에 직접 등록합니다. 이미 `forwardRef(() => GameModule)`로 순환 의존성을 해소하고 있는 상황에서 Game 엔티티를 RoomModule이 직접 소유하는 것은 모듈 경계를 흐립니다. 동일 엔티티를 두 모듈에서 관리하는 것은 소유권 불명확으로 이어집니다.
  - 제안: GameService에 삭제 메서드를 추가하고 RoomModule은 GameModule을 통해서만 Game 데이터에 접근

- **[WARNING]** 테스트에서 `mockParticipantRepository`가 실제 사용 코드와 불일치
  - 위치: `room.service.spec.ts:43-50`
  - 상세: mock은 `createQueryBuilder().delete().where().execute()` 체인을 구현하지만, 각 mock 함수가 새로 생성된 객체를 반환하므로 `.delete()` → `.where()` 체인이 실제로 동일 객체에서 이어지지 않습니다. 현재 테스트가 통과하더라도 실제 동작을 검증하지 못하는 false positive 가능성이 있습니다.
  - 제안: 체인 mock을 단일 객체로 유지하도록 수정: `const qb = { delete: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn() }; createQueryBuilder: jest.fn(() => qb)`

- **[INFO]** Card.tsx 색상 수정은 아키텍처적으로 무관한 단순 버그 픽스
  - 위치: `frontend/src/components/cards/Card.tsx:22-23`
  - 상세: 흰 배경 카드에 흰 텍스트(`text-white`)를 사용하던 오류를 `text-gray-900`으로 수정. 아키텍처 관점 이슈 없음.

---

### 요약

이번 변경의 핵심 목적(외래키 제약 오류 해결, 카드 가시성 수정)은 타당하나, 구현 방식이 아키텍처 원칙을 훼손합니다. 가장 심각한 문제는 **RoomService가 Game 도메인의 삭제 책임을 직접 가져온 것**으로, 이는 SRP 위반이자 모듈 경계 침범입니다. DB CASCADE를 추가하면서 동시에 애플리케이션 레벨에서 동일한 삭제를 수행하는 이중화, 그리고 다단계 삭제에 트랜잭션이 없는 것은 추후 데이터 정합성 문제로 이어질 수 있습니다. 올바른 방향은 `GameService.deleteByRoom(roomId)` 메서드를 추가하고 DB CASCADE 또는 트랜잭션 기반 삭제 중 하나의 전략을 일관되게 적용하는 것입니다.

### 위험도

**HIGH**