## 의존성 코드 리뷰

### 발견사항

- **[INFO]** 새 외부 패키지 없음
  - 위치: 전체 변경 파일
  - 상세: 이번 변경에서 새로운 npm 패키지 또는 외부 라이브러리가 추가되지 않았습니다. 모든 변경은 기존 TypeORM, NestJS, Vitest 인프라를 활용합니다.
  - 제안: 해당 없음

- **[WARNING]** SQLite 스키마 변경 - 마이그레이션 미적용 위험
  - 위치: `backend/src/game/game.entity.ts` - `@Column({ nullable: true })`, `@ManyToOne({ onDelete: 'SET NULL' })`
  - 상세: `roomId` 컬럼의 `nullable: true` 전환 및 외래키 제약을 `CASCADE → SET NULL`으로 변경하면 DB 스키마가 변경됩니다. SQLite는 ALTER COLUMN 및 외래키 제약 수정을 지원하지 않습니다. `synchronize: true` 사용 시 TypeORM이 기존 컬럼을 자동으로 변경하지 못해 서버 재시작 후 스키마 불일치가 발생할 수 있습니다.
  - 제안: 마이그레이션 파일을 생성하거나, 개발 환경에서는 DB 파일을 삭제 후 재시작하여 스키마를 재생성해야 합니다. 프로덕션 환경이라면 테이블 재생성 마이그레이션이 필요합니다.

- **[WARNING]** `roomId: string | null` 타입 변경의 전파 범위
  - 위치: `backend/src/game/game.entity.ts:21`
  - 상세: `roomId`가 `string | null`로 변경되었으나, `game.service.ts`의 `deleteByRoom` 쿼리 `{ roomId, status: 'in-progress' }` 및 다른 모듈에서 `game.roomId`를 `string`으로 사용하는 코드가 있다면 타입 오류 또는 런타임 오류가 발생할 수 있습니다.
  - 제안: `gameRepository.find({ where: { roomId } })` 등 roomId를 직접 사용하는 모든 쿼리에서 null 가능성을 검토해야 합니다.

- **[INFO]** 테스트 목(mock) 구조 분리 - `mockQueryRunnerForDelete`
  - 위치: `backend/src/game/game.service.spec.ts:40-58`
  - 상세: `deleteByRoom` 전용 목을 별도로 분리한 것은 적절합니다. 각 테스트에서 `mockReturnValue`로 덮어쓰므로 기존 테스트와 격리됩니다. 다만 `mockDeleteQueryBuilder`가 모듈 레벨 공유 객체이므로 `jest.clearAllMocks()`가 `beforeEach`에 있어 충돌은 없습니다.
  - 제안: 해당 없음

- **[INFO]** 프론트엔드 `GameEndResult` 타입 확장
  - 위치: `frontend/src/hooks/useGameStore.spec.ts:87-89`
  - 상세: `placement`, `isAI` 필드가 테스트 데이터에 추가되어 백엔드 응답 타입과 일치하도록 업데이트되었습니다. 이는 타입 일관성을 높이는 변경입니다.
  - 제안: 해당 없음

- **[INFO]** 내부 모듈 의존 관계 변경 - Game → Room 결합도 완화
  - 위치: `game.entity.ts` `@ManyToOne`
  - 상세: `CASCADE → SET NULL` 변경으로 Room 삭제 시 Game 레코드가 유지됩니다. 이는 명예의 전당 보존 목적에 맞는 의도적인 설계 결정입니다. `deleteByRoom`에서 `in-progress` 게임만 삭제하는 변경과 논리적으로 일관됩니다.
  - 제안: 해당 없음

---

### 요약

이번 변경은 외부 패키지 추가 없이 기존 TypeORM, NestJS 의존성 범위 내에서 이루어졌습니다. 가장 주목할 점은 `game.entity.ts`의 스키마 변경(`nullable: true`, `SET NULL`)으로, SQLite 환경에서 자동 마이그레이션이 적용되지 않을 경우 서버 재시작 시 스키마 불일치가 발생할 수 있습니다. 내부 모듈 간 의존 관계는 명예의 전당 보존 요구사항에 맞게 올바르게 완화되었으며, 테스트 목 구조와 타입 업데이트는 일관성 있게 처리되었습니다.

### 위험도

**LOW** - 외부 의존성 변경 없음. SQLite 스키마 마이그레이션 미처리 시 개발 환경에서 재시작 오류 가능성 존재.