### 발견사항

- **[WARNING]** RoomModule이 Game 도메인 엔티티에 직접 의존
  - 위치: `room.module.ts:5-6`, `room.service.ts:6-7`
  - 상세: `RoomModule`이 `GameModule`을 `forwardRef`로 참조하면서, 추가로 `Game`, `GameParticipant` 엔티티를 `TypeOrmModule.forFeature`에 직접 등록하고 있습니다. 이는 모듈 경계를 침범하는 이중 의존 구조입니다. `forwardRef` 자체가 이미 순환 의존성의 징조인데, 게임 엔티티까지 Room 모듈에 직접 포함시키면 의존 방향이 모호해집니다.
  - 제안: 게임 레코드 정리 책임은 `GameService`로 이전하고, `RoomService`가 `GameService.deleteByRoomId(roomId)` 형태로 호출하도록 리팩토링. 이미 `forwardRef`로 `GameModule`을 참조하고 있으므로 가능한 구조입니다.

- **[WARNING]** CASCADE 설정과 수동 삭제 로직의 중복
  - 위치: `game-participant.entity.ts:37,41`, `room.service.ts:183-194`
  - 상세: `GameParticipant`에 `onDelete: 'CASCADE'`를 설정했지만, `RoomService.leaveRoom()`에서 게임 참여자를 수동으로 삭제하는 코드도 남아 있습니다. TypeORM의 `onDelete: 'CASCADE'`는 DB 스키마에 반영될 경우 게임 삭제 시 참여자가 자동 삭제되므로 수동 삭제는 불필요합니다. 단, `synchronize: true` 또는 마이그레이션이 실행되지 않았다면 DB 스키마에 CASCADE가 반영되지 않아 수동 삭제가 여전히 필요할 수 있습니다.
  - 제안: DB 스키마에 CASCADE가 실제로 적용되었는지 확인 후, 적용된 경우 `participantRepository`를 통한 수동 삭제 로직 제거. 스키마 동기화가 보장되지 않는다면 수동 삭제를 유지하되, `onDelete: 'CASCADE'` 설정의 의도를 주석으로 명시.

- **[WARNING]** 테스트의 `mockParticipantRepository`가 실제 구현과 불일치
  - 위치: `room.service.spec.ts:43-50`
  - 상세: mock의 `createQueryBuilder`가 반환하는 체인은 매번 새 객체를 반환하지 않고 동일 참조를 반환합니다(`mockReturnThis()`). 실제 TypeORM QueryBuilder의 메서드 체이닝 방식과 동일하지만, `createQueryBuilder`가 여러 번 호출될 경우 이전 테스트의 상태가 공유될 수 있습니다. 또한 `mockParticipantRepository`가 실제로 사용되는지 검증하는 assertion이 테스트에 없습니다.
  - 제안: `mockGameRepository.find`에 대한 assertion은 있으나 `mockParticipantRepository`의 `execute` 호출 여부 검증도 추가. `createQueryBuilder`를 `jest.fn()`으로 매 호출마다 새 객체 반환하도록 개선.

- **[INFO]** Card.tsx의 변경은 의존성과 무관
  - 위치: `frontend/src/components/cards/Card.tsx:22-23`
  - 상세: `text-white` → `text-gray-900` 변경은 Tailwind CSS 클래스 변경으로 외부 의존성에 영향 없음. 순수 스타일 수정입니다.

- **[INFO]** 새로운 외부 패키지 추가 없음
  - 상세: 이번 변경에서 `package.json`에 새로운 외부 의존성이 추가되지 않았습니다. 모든 변경은 기존 TypeORM, NestJS 내부 모듈 간 의존 구조 조정입니다.

---

### 요약

이번 변경의 핵심 의존성 이슈는 **모듈 경계 침범**입니다. `RoomModule`이 `GameModule`을 `forwardRef`로 참조하는 동시에 `Game`, `GameParticipant` 엔티티를 직접 등록하고 관리함으로써, Room과 Game 도메인 간 경계가 흐려졌습니다. 게임 레코드 삭제 책임이 `RoomService`에 누적되는 것은 단일 책임 원칙에 위배되며, 향후 게임 삭제 로직 변경 시 두 모듈을 동시에 수정해야 하는 유지보수 부담이 생깁니다. `onDelete: 'CASCADE'` 설정의 의도는 좋으나 DB 실제 적용 여부와 수동 삭제 코드의 공존이 혼란을 야기할 수 있으므로 명확한 정리가 필요합니다.

### 위험도

**MEDIUM**