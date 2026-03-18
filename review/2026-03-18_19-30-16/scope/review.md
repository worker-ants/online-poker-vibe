## 리뷰 결과

### 발견사항

- **[INFO]** `game-participant.entity.ts` — `onDelete: 'CASCADE'` 추가
  - 위치: `@ManyToOne` 데코레이터 2건
  - 상세: FK 제약 실패 오류를 해결하기 위한 직접적인 수정. 범위 내 변경.
  - 제안: 없음

- **[INFO]** `game.entity.ts` — `onDelete: 'CASCADE'` 추가
  - 위치: `@ManyToOne(() => Room, ...)` 
  - 상세: 동일 맥락의 FK 연쇄 삭제 설정. 범위 내 변경.
  - 제안: 없음

- **[WARNING]** `room.service.ts` — 수동 CASCADE 삭제 로직 추가 (`leaveRoom`)
  - 위치: 180–197라인
  - 상세: 엔티티에 `onDelete: 'CASCADE'`를 이미 설정했음에도, `room.service.ts`에서 `GameParticipant`와 `Game`을 수동으로 삭제하는 로직을 별도로 추가했습니다. DB CASCADE와 애플리케이션 레벨 삭제가 중복됩니다. 또한 `participantRepository`의 수동 `DELETE`는 `onDelete: 'CASCADE'`로 이미 처리되므로 불필요한 코드입니다.
  - 제안: 두 방식 중 하나만 유지해야 합니다. DB CASCADE에 의존한다면 서비스 레벨의 수동 삭제 코드를 제거하거나, 반대로 서비스에서 명시적으로 삭제한다면 엔티티의 CASCADE 설정은 안전망 역할을 합니다. 단, 현재 구현은 동일 작업을 두 번 수행할 수 있어 의미가 불분명합니다.

- **[WARNING]** `room.module.ts` + `room.service.ts` — `Game`, `GameParticipant` 레포지토리를 `RoomModule`에 추입
  - 위치: `room.module.ts` imports, `room.service.ts` 생성자
  - 상세: 수동 삭제 로직 추가에 따른 파생 변경입니다. DB CASCADE만 사용한다면 이 변경 전체가 불필요합니다. `RoomModule`이 `GameModule`을 `forwardRef`로 이미 참조하고 있는 상황에서 Game 엔티티 레포지토리를 직접 주입하는 것은 모듈 경계를 모호하게 만듭니다.
  - 제안: FK CASCADE를 신뢰한다면 `room.module.ts`와 `room.service.ts`의 Game/GameParticipant 관련 추가를 제거하세요.

- **[INFO]** `room.service.spec.ts` — 추가된 레포지토리에 맞는 테스트 업데이트
  - 상세: 서비스 변경에 따른 자연스러운 테스트 보강. 범위 내 변경.
  - 제안: 없음

- **[INFO]** `Card.tsx` — `clubs`, `spades` 색상을 `text-white` → `text-gray-900`으로 변경
  - 위치: `SUIT_COLORS` 상수
  - 상세: "흰 카드로만 보임" 이슈 수정. 흰 배경 카드에 흰 글자가 보이지 않던 문제를 해결. 범위 내 변경.
  - 제안: 없음

- **[INFO]** `history/history.md` — Turn 11 기록 추가
  - 상세: 작업 이력 기록. 범위 내 변경.

---

### 요약

변경 범위는 보고된 두 가지 이슈(FK 제약 실패, 카드 미표시)에 집중되어 있어 전반적으로 적절합니다. 다만 핵심 문제가 있습니다: **FK 제약 실패를 해결하기 위해 엔티티에 `onDelete: 'CASCADE'`를 추가하고, 동시에 `RoomService`에 수동 삭제 로직까지 추가하여 같은 문제를 두 가지 방식으로 중복 해결**하고 있습니다. 이로 인해 `RoomModule`이 `Game`/`GameParticipant` 레포지토리를 불필요하게 의존하게 되어 모듈 경계가 흐려집니다. 한 가지 방식으로 통일이 필요합니다.

### 위험도

**MEDIUM** — 중복 삭제 로직으로 인한 의도치 않은 부작용 가능성 및 모듈 결합도 증가