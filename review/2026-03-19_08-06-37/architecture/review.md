## 아키텍처 코드 리뷰

### 발견사항

---

- **[WARNING]** `deleteByRoom` 메서드명이 실제 동작과 불일치
  - 위치: `backend/src/game/game.service.ts:376`
  - 상세: 메서드명은 "방에 속한 게임 삭제"를 암시하지만, 실제로는 `in-progress` 상태의 게임만 삭제함. 호출자는 모든 관련 게임이 삭제된다고 오해할 수 있으며, 이는 최소 놀람 원칙(Principle of Least Surprise) 위반
  - 제안: `deleteInProgressGamesByRoom` 또는 `cleanupActiveGamesByRoom`으로 이름 변경 검토

---

- **[WARNING]** `Game` 엔티티의 `room` 관계 타입 불일치
  - 위치: `backend/src/game/game.entity.ts:44`
  - 상세: `roomId`는 `string | null`로 선언되었고 `onDelete: 'SET NULL'`이 적용되어 있지만, 연관 관계 필드 `room: Room`은 `Room | null`이 아님. Room 삭제 후 `game.room`을 참조하면 TypeScript는 오류를 감지하지 못하고 런타임에서 null 참조 오류 발생 가능
  - 제안:
    ```typescript
    @ManyToOne(() => Room, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'roomId' })
    room: Room | null;
    ```

---

- **[INFO]** 비즈니스 규칙이 주석으로만 문서화됨
  - 위치: `backend/src/game/game.service.ts:377`
  - 상세: "completed/abandoned games are preserved for Hall of Fame"는 중요한 비즈니스 정책이지만, 코드 주석으로만 표현됨. 이 규칙이 다른 곳에서도 필요할 경우 일관성 유지가 어려움
  - 제안: 현재 프로젝트 규모에서는 주석 수준이 적절하나, 향후 확장 시 삭제 정책을 설정값이나 전략 패턴으로 추출 검토

---

- **[INFO]** 테스트 목(Mock) 객체 중복 정의
  - 위치: `backend/src/game/game.service.spec.ts:38-60`
  - 상세: `mockQueryRunner`와 `mockQueryRunnerForDelete`가 거의 동일한 구조로 두 번 정의됨. `deleteByRoom`이 `remove`와 `createQueryBuilder`를 추가로 필요로 하는 이유로 분리된 것이지만, 단일 포괄적 mock으로 통합하면 유지보수성 향상 가능
  - 제안: 기본 `mockQueryRunner`에 `remove`, `createQueryBuilder`를 추가하여 단일화

---

- **[INFO]** `CLAUDE.md` WORKFLOW 분리는 아키텍처적으로 긍정적
  - 위치: `CLAUDE.md`
  - 상세: TEST WORKFLOW와 REVIEW WORKFLOW를 명확히 분리하고 각 단계에서 실패 시 재시작 기준을 명시한 것은 프로세스 설계 관점에서 관심사 분리(SoC)가 잘 적용된 개선

---

### 요약

이번 변경의 핵심은 Room 삭제 시 완료된 게임 기록을 보존하는 데이터 보존 전략(`onDelete: 'SET NULL'`)을 도입한 것으로, 명예의 전당 기능과의 연계성을 고려한 올바른 아키텍처 결정이다. 다만 `room: Room` 관계 필드의 타입이 `nullable`을 반영하지 않아 TypeScript의 타입 안전성이 깨지는 점이 가장 주목해야 할 이슈이며, `deleteByRoom` 메서드명의 의미론적 불일치도 향후 혼란을 야기할 수 있다. 전반적인 레이어 분리와 트랜잭션 관리는 적절히 유지되고 있다.

### 위험도

**LOW**