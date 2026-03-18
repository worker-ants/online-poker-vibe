## 발견사항

### **[WARNING]** `synchronize` 옵션이 비프로덕션 환경에서 활성화됨
- 위치: `backend/src/database/database.module.ts:10`
- 상세: `synchronize: process.env.NODE_ENV !== 'production'`은 개발/테스트 환경에서 TypeORM이 엔티티 변경 시 스키마를 자동으로 수정합니다. 컬럼 삭제/변경 시 **데이터 손실** 위험이 있고, 스테이징 환경에서 의도치 않은 마이그레이션이 발생할 수 있습니다.
- 제안: `synchronize`는 항상 `false`로 설정하고, TypeORM Migration을 명시적으로 사용하세요. 개발 편의를 위한다면 별도의 `db:sync` 스크립트로 분리하는 것을 권장합니다.

```typescript
synchronize: false, // 항상 false
// migrations: [join(__dirname, 'migrations', '*.js')],
// migrationsRun: true,
```

### **[INFO]** NicknameRequiredGuard의 매 요청마다 DB 조회
- 위치: `backend/src/common/guards/nickname-required.guard.ts:17`
- 상세: 보호된 모든 요청에서 `playerService.isNicknameSet(uuid)`를 호출합니다. `player_uuid` 컬럼에 인덱스가 없다면 요청마다 풀 스캔이 발생합니다. 플레이어 엔티티에 인덱스가 있는지 확인이 필요합니다.
- 제안: `player_uuid` 컬럼에 `@Index()` 데코레이터를 적용하세요. 세션 기반 캐싱을 고려할 수도 있습니다.

### **[INFO]** SQLite 단일 쓰기 잠금
- 위치: `backend/src/database/database.module.ts`
- 상세: `better-sqlite3`는 동기 방식의 단일 쓰기 연결만 지원합니다. 동시 다수 게임 세션에서 쓰기 경합이 발생할 경우 처리 지연이 생길 수 있습니다. 현재 구조(in-memory 게임 상태 + DB는 결과 저장용)라면 문제는 제한적입니다.
- 제안: 현재 게임 규모에선 허용 가능한 트레이드오프이지만, 확장 시 PostgreSQL 전환을 고려하세요.

---

나머지 파일들(Files 1–45, 47–50)은 프론트엔드 컴포넌트, 훅, in-memory 게임 엔진 로직으로 데이터베이스와 직접적인 관련이 없습니다.

---

### 요약
리뷰 대상 코드에서 데이터베이스와 직접 관련된 파일은 `database.module.ts`와 `nickname-required.guard.ts` 두 파일입니다. 가장 주의가 필요한 부분은 `synchronize: true` 설정으로, 스테이징 환경에서 의도치 않은 스키마 변경이나 데이터 손실로 이어질 수 있어 명시적 마이그레이션 방식으로 전환이 권장됩니다. 나머지 게임 엔진 로직은 모두 in-memory 상태 관리로 처리되어 DB 접근이 없고, SQLite 선택은 현재 단일 서버 게임 규모에서는 적합합니다.

### 위험도
**LOW**