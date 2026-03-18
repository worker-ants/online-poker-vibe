## 부작용(Side Effect) 코드 리뷰

---

### 발견사항

---

**[CRITICAL] DB 스키마 변경에 대한 마이그레이션 누락**
- 위치: `game.entity.ts` — `roomId` 컬럼 정의
- 상세: `nullable: true` 추가와 `onDelete: 'CASCADE' → SET NULL` 변경은 기존 SQLite 스키마를 수정해야 합니다. TypeORM `synchronize: true` 설정이 없거나, 마이그레이션 파일이 없으면 기존 DB가 있는 환경(개발, 스테이징, 운영)에서 실행 즉시 오류가 발생합니다.
- 제안: 마이그레이션 파일을 작성하거나 `synchronize: true` 설정이 개발 환경에서만 적용됨을 명확히 확인할 것

---

**[WARNING] `deleteByRoom` 호출 순서에 따른 무결성 위험**
- 위치: `game.service.ts` — `deleteByRoom`, `game.entity.ts` — `onDelete: 'SET NULL'`
- 상세: 호출 순서에 따라 부작용이 달라집니다.
  - 순서 A (올바름): `deleteByRoom('room-1')` → Room 삭제 → 진행 중 게임 삭제됨, 완료 게임은 roomId=NULL 보존
  - 순서 B (문제): Room 삭제 먼저 → DB가 모든 게임의 roomId를 NULL로 SET → `deleteByRoom('room-1')` 호출 → `WHERE roomId='room-1'` 조건에 일치하는 게임 없음 → 진행 중이던 게임이 고아 레코드로 남음
  - 호출하는 `RoomService` 또는 Gateway 코드에서 이 순서가 보장되지 않으면 진행 중 게임 레코드가 DB에 누적됩니다.
- 제안: Room 삭제 트랜잭션 내에서 `deleteByRoom` → Room 삭제 순서를 트랜잭션으로 묶어 보장하거나, `deleteByRoom` 내에서 `roomId IS NULL AND status='in-progress'` 케이스도 처리할 것

---

**[WARNING] `roomId: string | null` 타입 변경에 따른 기존 호출자 영향**
- 위치: `game.entity.ts` — `roomId` 필드
- 상세: `roomId`가 `string | null`로 변경되었으므로, `game.roomId.toLowerCase()`, `game.roomId.includes(...)` 등 non-null 가정으로 작성된 코드가 있다면 런타임 오류가 발생합니다. 변경 diff에는 service/gateway 코드에서 해당 필드를 사용하는 호출자의 null 체크 적용 여부가 포함되어 있지 않습니다.
- 제안: `grep -r "\.roomId" backend/src` 로 모든 사용 지점을 확인하고 null 가드 추가 여부를 검토할 것

---

**[WARNING] `deleteByRoom` 테스트에서 GameParticipant 삭제 검증 누락**
- 위치: `game.service.spec.ts` — `deleteByRoom` 테스트
- 상세: 실제 구현은 `GameParticipant`를 먼저 삭제(`createQueryBuilder().delete().from(GameParticipant).where(...).execute()`)한 후 game을 삭제합니다. 테스트에서는 `delete`가 호출되었는지는 확인하지만, `from(GameParticipant)`와 `where('gameId IN (:...gameIds)')` 검증이 없습니다. 잘못된 테이블이나 조건으로 참여자 데이터를 삭제해도 이 테스트는 통과합니다.
- 제안: `expect(mockDeleteQueryBuilder.from).toHaveBeenCalledWith(GameParticipant)` 및 `expect(mockDeleteQueryBuilder.where).toHaveBeenCalledWith(...)` 검증을 추가할 것

---

**[INFO] CLAUDE.md 워크플로우 변경으로 인한 빌드 단계 추가**
- 위치: `CLAUDE.md` — `TEST WORKFLOW`
- 상세: 기존 워크플로우(lint → unit test)에 `other tests`와 `build` 단계가 추가되었습니다. 이 자체는 품질 향상이지만, 기존 e2e/integration 테스트가 CI에서 실패하면 이전보다 더 자주 블로킹이 발생할 수 있습니다.
- 제안: `other tests` 범위를 명확히 정의(e.g., integration, e2e)하여 모호성을 제거할 것

---

**[INFO] `useGameStore.spec.ts` — `GameEndResult` 타입 동기화 확인**
- 위치: `useGameStore.spec.ts` — `results` 배열
- 상세: `placement`, `isAI` 필드가 테스트 데이터에 추가되었습니다. 이는 `GameEndResult` 타입에 해당 필드가 필수로 추가된 결과입니다. 프론트엔드 UI 컴포넌트 중 `GameEndResult`를 소비하는 곳에서 이 새 필드들을 활용하고 있는지, 또는 무시되고 있는지 확인이 필요합니다.
- 제안: 게임 종료 화면에서 `isAI` 플레이어를 별도로 표시하거나 필터링하는 UI 로직과 연계 여부를 확인할 것

---

### 요약

이번 변경의 핵심은 게임 완료 기록을 Room 삭제 후에도 보존하기 위한 DB 참조 전략 변경(`CASCADE → SET NULL`)과 `deleteByRoom`의 범위 축소입니다. 설계 의도 자체는 명예의 전당 데이터 보존에 적합하나, **DB 마이그레이션 파일이 동반되지 않은 스키마 변경**과 **Room 삭제와 `deleteByRoom` 호출 순서의 보장 여부**가 가장 큰 부작용 위험입니다. 특히 Room 먼저 삭제 시 `SET NULL`이 적용되어 진행 중이던 게임 레코드가 정리되지 않고 누적될 수 있으며, 이는 DB 용량 증가 및 데이터 불일치로 이어집니다. `roomId: string | null` 타입 변경은 기존 코드에서 암묵적 non-null 가정이 있는 경우 런타임 오류를 유발할 수 있으므로 전체 사용 지점 검토가 필요합니다.

### 위험도

**MEDIUM**