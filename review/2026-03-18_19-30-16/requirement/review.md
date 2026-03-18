### 발견사항

---

**[WARNING] `onDelete: 'CASCADE'` 추가로 인한 데이터 정합성 개선 — 그러나 기존 DB 스키마와 불일치 가능성**
- 위치: `game-participant.entity.ts`, `game.entity.ts`
- 상세: TypeORM의 `onDelete: 'CASCADE'`는 새 테이블 생성 시에만 적용됩니다. 기존 SQLite DB가 이미 존재하는 경우, 마이그레이션 없이는 해당 옵션이 실제 DB에 반영되지 않습니다. `synchronize: true` 설정이라도 SQLite는 기존 컬럼에 CASCADE를 추가하지 못합니다.
- 제안: 기존 DB 파일(`backend/data/poker.sqlite`) 삭제 또는 마이그레이션 스크립트 실행이 필요함을 명시해야 합니다. 또는 `synchronize` 대신 명시적 마이그레이션으로 전환해야 합니다.

---

**[WARNING] `RoomService.leaveRoom`의 수동 삭제 로직이 CASCADE와 중복**
- 위치: `room.service.ts:183-197`
- 상세: `Game → GameParticipant`에 `onDelete: 'CASCADE'`를 추가했으면서도, `leaveRoom`에서 `GameParticipant`를 수동으로 삭제하는 로직을 별도로 구현하고 있습니다. DB 레벨 CASCADE가 실제로 적용되면 이중 삭제가 되고, 적용되지 않으면 수동 삭제에만 의존하게 됩니다.
- 제안: CASCADE가 확실히 적용된다면 수동 삭제 코드를 제거하거나, CASCADE를 제거하고 수동 삭제만 유지하는 방식으로 일관성을 맞춰야 합니다.

---

**[WARNING] `GameParticipant` 삭제 시 `gameIds`가 빈 배열인 경우 쿼리 오류 가능성**
- 위치: `room.service.ts:188-195`
- 상세: `games.length > 0` 조건 안에서 처리하므로 빈 배열 자체는 진입하지 않지만, `gameIds`가 빈 배열로 전달될 경우 `WHERE gameId IN ()` 구문이 SQLite에서 오류를 유발할 수 있습니다. 현재 코드는 안전하게 처리되어 있으나, 향후 리팩토링 시 위험 요소입니다.
- 제안: 현재 구조는 유지하되, 주석으로 의도를 명시하면 좋습니다.

---

**[WARNING] 테스트에서 `mockParticipantRepository`가 실제 구현과 불일치**
- 위치: `room.service.spec.ts:44-51`
- 상세: `mockParticipantRepository`는 `createQueryBuilder().delete().where().execute()` 체인을 모킹하고 있지만, 각 단계에서 반환되는 mock 객체가 체인 전체를 공유하지 않습니다. `jest.fn().mockReturnThis()`는 각 호출에서 같은 객체를 반환하는데, `createQueryBuilder`가 매번 새 객체를 생성하므로 검증이 제한적입니다.
- 제안: `mockParticipantRepository`의 호출 검증 단언이 테스트에 없어 실제로 `GameParticipant` 삭제가 호출되었는지 검증되지 않습니다. 테스트 명세 상 `mockGameRepository.remove`만 검증하고 participant 삭제는 검증하지 않습니다.

---

**[INFO] `Card.tsx` — 흰 카드 이슈 수정이 요구사항을 충족**
- 위치: `Card.tsx:22-23`
- 상세: `clubs`/`spades`의 색상을 `text-white`에서 `text-gray-900`으로 변경하여, 흰 배경 카드에서 검정 무늬가 보이지 않던 이슈를 해결했습니다. 이는 Turn 11의 "흰 카드로만 보임" 요구사항에 직접 대응합니다.
- 제안: 이슈 해결 완료. 별도 조치 불필요.

---

**[INFO] `room.module.ts` — `Game`, `GameParticipant` 엔티티 등록이 필요하고 올바름**
- 위치: `room.module.ts:16`
- 상세: `RoomService`에서 `gameRepository`와 `participantRepository`를 주입받기 위해 모듈에 해당 엔티티를 등록한 것은 올바른 처리입니다.
- 제안: 이슈 해결 완료.

---

**[WARNING] `leaveRoom`에서 Room 삭제 시 트랜잭션 미사용**
- 위치: `room.service.ts:183-200`
- 상세: `GameParticipant` 삭제 → `Game` 삭제 → `Room` 삭제가 순차적으로 수행되지만 트랜잭션으로 묶여 있지 않습니다. 중간 단계에서 실패하면 데이터가 부분적으로 삭제된 상태로 남을 수 있습니다. `createRoom`은 트랜잭션을 사용하고 있어 일관성이 없습니다.
- 제안: 삭제 로직 전체를 `QueryRunner` 트랜잭션으로 감싸는 것을 권장합니다.

---

### 요약

이번 변경은 Turn 11에서 보고된 두 가지 이슈("FOREIGN KEY constraint failed", "흰 카드로만 보임")를 해결하기 위한 것으로, 카드 색상 수정은 명확히 요구사항을 충족합니다. FK 오류 해결을 위해 `onDelete: 'CASCADE'` 추가 및 수동 삭제 로직을 구현했으나, SQLite의 특성상 기존 DB에 CASCADE가 실제 반영되지 않을 수 있어 배포/재현 환경에 따라 여전히 오류가 발생할 가능성이 있습니다. 또한 CASCADE와 수동 삭제 로직이 중복으로 존재하고, 삭제 로직에 트랜잭션이 없어 데이터 정합성 위험이 남아 있습니다. 테스트는 `Game` 삭제까지만 검증하고 `GameParticipant` 삭제 호출 검증이 누락되어 있습니다.

### 위험도

**MEDIUM**