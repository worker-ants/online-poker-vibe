## 리뷰 결과

### 발견사항

---

**[WARNING] `onDelete: 'CASCADE'` 추가로 인한 데이터 자동 삭제 동작 변경**
- 위치: `game-participant.entity.ts`, `game.entity.ts`
- 상세: `Game` 삭제 시 `GameParticipant`가 자동으로 삭제되고, `Room` 삭제 시 `Game`이 자동으로 삭제됩니다. 이는 DB 레벨의 CASCADE 동작으로, TypeORM의 `remove()` 호출 없이도 삭제가 전파됩니다. 기존 코드에서 수동으로 처리하던 삭제 흐름과 중복될 수 있습니다.
- 제안: `room.service.ts`의 수동 삭제 로직(`participantRepository.delete()` → `gameRepository.remove()` → `roomRepository.remove()`)이 CASCADE와 이중으로 작동합니다. DB CASCADE만 신뢰하거나 수동 처리만 사용하도록 통일 필요.

---

**[WARNING] `leaveRoom`의 수동 삭제 로직과 DB CASCADE의 이중 실행 가능성**
- 위치: `room.service.ts:180-197`
- 상세: `Room`에 `onDelete: 'CASCADE'`가 설정되어 있으므로 `roomRepository.remove(room)`만 호출해도 DB가 연관된 `Game`, `GameParticipant`를 자동 삭제합니다. 그러나 코드는 먼저 `participantRepository`로 `GameParticipant`를 삭제하고, `gameRepository`로 `Game`을 삭제한 후, `roomRepository`로 `Room`을 삭제합니다. 이 중 앞의 두 단계는 이미 불필요합니다. 또한 트랜잭션 없이 순차 삭제가 이루어져 중간 실패 시 데이터 불일치가 발생할 수 있습니다.
- 제안: 트랜잭션으로 감싸거나, DB CASCADE를 믿고 `roomRepository.remove(room)` 한 줄로 단순화.

---

**[WARNING] `RoomModule`에 `Game`, `GameParticipant` 엔티티 등록으로 인한 순환 의존성 위험**
- 위치: `room.module.ts`
- 상세: `RoomModule`은 이미 `forwardRef(() => GameModule)`로 `GameModule`을 참조하고 있습니다. 여기에 `Game`, `GameParticipant` 엔티티를 `TypeOrmModule.forFeature()`에 직접 등록하면, `GameModule`도 동일 엔티티를 등록할 가능성이 높아 같은 엔티티가 두 모듈에서 이중 등록됩니다. TypeORM은 이를 허용하지만, 두 모듈이 서로 다른 Repository 인스턴스를 가지게 되어 동일 엔티티에 대해 두 개의 독립된 Repository가 존재하게 됩니다.
- 제안: `GameModule`에서 Repository를 export하여 `RoomModule`이 직접 엔티티를 등록하지 않고 주입받도록 리팩터링 권장.

---

**[INFO] `Card.tsx`의 색상 변경 (`text-white` → `text-gray-900`)**
- 위치: `Card.tsx:22-23`
- 상세: 카드 배경이 흰색(`bg-white`)인데 clubs/spades가 `text-white`였던 것은 명백히 버그였습니다. `text-gray-900`으로 변경은 올바른 수정입니다. 기존 `text-white` fallback(`suitColor ?? 'text-white'`)도 동일하게 고려 필요합니다.
- 제안: 47번째 줄의 `'text-white'` fallback도 `'text-gray-900'`으로 변경 권장.

---

**[INFO] `mockParticipantRepository`의 QueryBuilder 체이닝이 실제 구현과 불일치**
- 위치: `room.service.spec.ts:44-51`
- 상세: Mock에서 `createQueryBuilder()` 호출 결과가 새 객체를 반환하지 않고, 각 체이닝 메서드가 `mockReturnThis()`를 사용합니다. 실제 구현에서 `.delete().where(...).execute()`를 호출하는 구조와는 기능적으로 동일하지만, mock이 `delete()`의 반환값에서 `where()`를 호출하는 구조를 정확히 반영하지 않습니다.
- 제안: 현재 테스트는 정상 동작하지만, 체이닝 검증이 필요하다면 각 단계별로 spy를 분리하여 검증 강화 가능.

---

### 요약

이번 변경의 핵심 목적은 Room 삭제 시 연관 Game/GameParticipant 레코드의 `FOREIGN KEY constraint` 오류를 해결하는 것입니다. 그러나 DB CASCADE(`onDelete: 'CASCADE'`)와 `room.service.ts`의 수동 삭제 로직이 동시에 존재하여 동작이 중복되고, 트랜잭션 없이 순차 삭제가 이루어지므로 부분 실패 시 데이터 불일치 위험이 있습니다. 또한 `RoomModule`이 `GameModule`의 엔티티를 직접 소유하는 구조는 `forwardRef` 순환 참조가 이미 존재하는 상황에서 모듈 경계 혼재를 심화시킵니다. `Card.tsx`의 색상 수정은 올바르지만 fallback 값도 함께 수정이 필요합니다.

### 위험도

**MEDIUM**