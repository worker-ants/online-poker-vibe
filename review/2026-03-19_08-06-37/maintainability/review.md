## 유지보수성 코드 리뷰

### 발견사항

---

#### CLAUDE.md

- **[INFO]** 워크플로우 구조화 개선
  - 위치: WORKFLOW, TEST WORKFLOW, REVIEW WORKFLOW 섹션
  - 상세: 기존의 단일 9단계 목록을 3개의 독립 섹션으로 분리하여 가독성이 향상됨. "반드시 누락없이 수행하세요" 강조 문구 추가로 의도가 더 명확해짐.
  - 제안: 현재 변경 방향이 적절하며 추가 개선 불필요.

---

#### game.entity.ts

- **[WARNING]** `roomId` nullable 변경과 관계 일관성
  - 위치: `roomId: string | null` 및 `@ManyToOne(..., { onDelete: 'SET NULL' })`
  - 상세: `roomId`를 nullable로 변경하고 `onDelete: 'SET NULL'`을 적용한 변경은 Hall of Fame 보존 목적으로 의도가 명확하나, `room` 관계 필드의 타입이 여전히 `Room`(non-nullable)으로 선언되어 있어 실제로 Room이 삭제된 후 `game.room`을 접근하면 null임에도 타입 불일치가 발생함.
  - 제안:
    ```typescript
    room: Room | null;
    ```

---

#### game.service.spec.ts

- **[WARNING]** 중복된 Mock 구조
  - 위치: `mockQueryRunner`(L38~) 및 `mockQueryRunnerForDelete`(L44~)
  - 상세: 두 mock 객체가 `connect`, `startTransaction`, `commitTransaction`, `rollbackTransaction`, `release`, `manager.update`, `manager.save`를 중복 정의하고 있음. `mockQueryRunnerForDelete`는 `remove`와 `createQueryBuilder`만 추가로 필요.
  - 제안: 기본 mock을 factory 함수로 분리하고 확장하는 방식으로 중복 제거:
    ```typescript
    function makeQueryRunner(extra = {}) {
      return {
        connect: jest.fn(), startTransaction: jest.fn(),
        commitTransaction: jest.fn(), rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: { update: jest.fn(), save: jest.fn((e) => Promise.resolve(e)), ...extra },
      };
    }
    const mockQueryRunner = makeQueryRunner();
    const mockQueryRunnerForDelete = makeQueryRunner({
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => mockDeleteQueryBuilder),
    });
    ```

- **[INFO]** Non-null assertion 사용 일관성
  - 위치: `publicState!.players`, `actionRequired!.playerUuid` 등
  - 상세: nullable 반환값에 `!` assertion을 추가한 것은 TypeScript strict 모드 대응으로 적절함. 다만 일부 위치(예: `actionRequired` 검증 후 `handleAction` 호출 시)에서는 `expect(...).not.toBeNull()` 직후임에도 assertion이 필요한 구조는 테스트 흐름상 어색할 수 있음.
  - 제안: 중요한 경우 `if (!x) throw new Error(...)` 패턴을 사용하거나, assertion 전에 타입 narrowing을 고려.

- **[INFO]** `deleteByRoom` 테스트의 검증 범위
  - 위치: `deleteByRoom` describe 블록
  - 상세: 트랜잭션 롤백(에러 케이스) 시나리오 테스트가 없음. `commitTransaction` 호출 여부 검증도 누락.
  - 제안: 에러 발생 시 `rollbackTransaction`이 호출되는지 확인하는 테스트 케이스 추가 권장.

---

#### game.service.ts

- **[INFO]** 주석으로 의도 명확화
  - 위치: `deleteByRoom` 메서드, L376~
  - 상세: "Only delete in-progress games; completed/abandoned games are preserved for Hall of Fame" 주석이 추가되어 비즈니스 의도가 명확하게 전달됨. 긍정적 변경.

- **[INFO]** `deleteByRoom` vs `finishGame`의 queryRunner 패턴 중복
  - 위치: `finishGame`(L~313) 및 `deleteByRoom`(L376~)
  - 상세: 두 메서드 모두 동일한 `createQueryRunner → connect → startTransaction → try/catch/finally rollback/release` 패턴을 반복하고 있음. 이는 이번 변경으로 도입된 문제는 아니나 향후 유지보수 부담.
  - 제안: `withTransaction(callback)` 헬퍼 추출을 장기적으로 고려.

---

#### useGameStore.spec.ts

- **[INFO]** 타입 정합성 개선
  - 위치: `GameEndResult` results 항목들
  - 상세: `placement`와 `isAI` 필드를 테스트 데이터에 추가하여 실제 타입과 일치시킨 것은 적절한 수정.

---

### 요약

이번 변경은 Hall of Fame에 AI 게임 기록이 누락되는 버그를 수정하기 위해 `roomId`를 nullable로 전환하고 `deleteByRoom`을 in-progress 게임만 삭제하도록 범위를 좁힌 것이 핵심입니다. 전반적으로 의도가 주석으로 명확하게 표현되었고 테스트 커버리지도 적절히 추가되었습니다. 다만 `game.entity.ts`의 `room: Room` 필드가 nullable로 갱신되지 않은 점은 런타임에서 타입 불일치를 유발할 수 있는 실질적 위험이며 수정이 필요합니다. 테스트 코드의 mock 중복은 장기 유지보수 관점에서 정리가 권장됩니다.

### 위험도

**LOW** (단, `room: Room | null` 미수정 시 MEDIUM)