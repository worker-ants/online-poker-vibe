파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `SUMMARY.md`를 저장하겠습니다.

그 전에 통합 보고서 내용을 먼저 공유드립니다:

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - DB 스키마 마이그레이션 누락, TOCTOU 경쟁 조건, 인메모리 상태 불일치 등 데이터 무결성 위협 요소 다수 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `roomId` nullable 변경 및 `onDelete: CASCADE → SET NULL`에 대한 **DB 마이그레이션 파일 누락**. 기존 DB가 있는 환경에서 서버 재시작 시 스키마 불일치 오류 발생 | `game.entity.ts` | 마이그레이션 파일 작성 또는 `synchronize: true` 적용 환경 명시 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency/database | `deleteByRoom`의 **TOCTOU 경쟁 조건**: `find`가 트랜잭션 외부에서 실행되어 `finishGame`과 동시 실행 시 완료된 게임 삭제 → 명예의 전당 데이터 유실 | `game.service.ts` — `deleteByRoom` | `find`를 트랜잭션 내부(`queryRunner.manager.find`)로 이동 |
| 2 | requirement/testing | `deleteByRoom` 후 **`this.activeGames` 인메모리 미정리**. 방 삭제 후에도 `isGameActive` = `true`, 동일 roomId 새 게임 시작 시 오류 | `game.service.ts` | `this.activeGames.delete(roomId)` 추가 |
| 3 | architecture/maintainability | **`room: Room` 타입 미수정** → `Room \| null` 이어야 함. Room 삭제 후 `game.room` 접근 시 런타임 null 참조 오류 | `game.entity.ts:44` | `room: Room \| null`, `@ManyToOne({ nullable: true })` 명시 |
| 4 | requirement/side_effect | **Room 먼저 삭제 시 순서 문제**: DB의 `SET NULL` 적용 후 `deleteByRoom` 호출 → 조건 불일치로 진행 중 게임이 고아 레코드로 누적 | `game.service.ts`, `room.service.ts` | Room 삭제 트랜잭션 내에서 `deleteByRoom` → Room 삭제 순서 원자적 보장 |
| 5 | testing | **롤백 경로 테스트 누락**: `remove()` 또는 `execute()` 실패 시 `rollbackTransaction` 호출 미검증 | `game.service.spec.ts` | 에러 시나리오 테스트 추가 |
| 6 | testing | **트랜잭션 생명주기 미검증**: `connect`, `startTransaction`, `commitTransaction`, `release` 호출 여부 불확인 | `game.service.spec.ts` | 각 메서드 호출 검증 추가 |
| 7 | testing/side_effect | **`GameParticipant` 삭제 대상 미검증**: `.from(GameParticipant)` 및 `where` 조건 미확인으로 다른 엔티티 삭제해도 테스트 통과 | `game.service.spec.ts:286` | `expect(mockDeleteQueryBuilder.from).toHaveBeenCalledWith(GameParticipant)` 검증 추가 |
| 8 | architecture | **메서드명 불일치**: `deleteByRoom`이 실제로는 in-progress만 삭제, 최소 놀람 원칙 위반 | `game.service.ts:376` | `deleteInProgressGamesByRoom`으로 이름 변경 검토 |
| 9 | dependency/side_effect | **`roomId` null 전파**: 기존 non-null 가정 코드에서 런타임 오류 가능 | `game.entity.ts:21`, 전체 호출자 | 전체 `.roomId` 사용 지점 null 가드 검토 |
| 10 | maintainability | **Mock 중복**: `mockQueryRunner`와 `mockQueryRunnerForDelete` 거의 동일 구조 중복 | `game.service.spec.ts:38-60` | factory 함수로 분리 |
| 11 | scope | **CLAUDE.md 범위 이탈**: 개발 방법론 리팩토링이 Turn 16 작업과 무관 | `CLAUDE.md` | 별도 커밋으로 분리 |
| 12 | api_contract | **API 계약 변경**: `roomId` nullable 노출로 기존 클라이언트 파손 가능 | `game.entity.ts:21`, DTO | 관련 DTO 및 클라이언트 타입 업데이트 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | performance | `finishGame` 루프 내 N+1 INSERT (`save` 개별 호출) | `game.service.ts` |
| 2 | performance | `getStartingChips()` 루프 내 반복 호출 (불변값) | `game.service.ts` |
| 3 | performance | `remove(games)` 개별 DELETE 가능성 | `game.service.ts` |
| 4 | database | `roomId + status` 복합 인덱스 없음 | `game.entity.ts` |
| 5 | database | `roomId=null AND status='in-progress'` 고아 레코드 `onModuleInit` 미처리 | `game.service.ts` |
| 6 | security | `deleteByRoom` 인가 검증 호출자 위임 | `game.service.ts` |
| 7 | security | DB 에러 그대로 전파 (정보 노출 가능) | `game.service.ts:396-398` |
| 8 | api_contract | WebSocket `game:ended`에 `placement`, `isAI` 추가 — 백엔드 emit 포함 여부 확인 필요 | `game.gateway.ts` |
| 9 | testing | `roomId=null` 레코드 보존 시나리오 테스트 없음 | `game.service.spec.ts` |
| 10 | testing | non-null assertion(`!`) 남용으로 테스트 의도 모호 | `game.service.spec.ts` |
| 11 | documentation | `deleteByRoom` JSDoc 누락 | `game.service.ts` |
| 12 | documentation | 테스트 케이스명 부정확 | `game.service.spec.ts` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM | DB 마이그레이션 누락(CRITICAL), Room 삭제 순서 의존성 |
| concurrency | MEDIUM | TOCTOU 경쟁 조건 |
| testing | MEDIUM | 롤백·트랜잭션 생명주기·인메모리 정리 테스트 누락 |
| requirement | MEDIUM | `activeGames` 미정리, 호출 순서 미검증, 롤백 테스트 누락 |
| database | MEDIUM(개발 LOW) | 스키마 마이그레이션 안전성 |
| architecture | LOW | 타입 불일치, 메서드명 불일치 |
| maintainability | LOW | 타입 불일치, mock 중복 |
| dependency | LOW | 마이그레이션, null 전파 |
| api_contract | LOW | nullable API 계약 변경 |
| performance | LOW | N+1 쿼리, 루프 내 불변값 반복 호출 |
| security | LOW | 인가 위임, DB 에러 노출 |
| scope | LOW | CLAUDE.md 범위 이탈 |
| documentation | LOW | JSDoc 누락, 테스트명 부정확 |

---

## 권장 조치사항

1. **[CRITICAL]** DB 마이그레이션 파일 작성 (`synchronize: true` 확인 또는 마이그레이션 스크립트)
2. **[WARNING]** `room: Room | null` 타입 수정 + `@ManyToOne({ nullable: true })` 명시
3. **[WARNING]** `deleteByRoom` 내 `this.activeGames.delete(roomId)` 추가
4. **[WARNING]** `find` 쿼리를 트랜잭션 내부로 이동 (TOCTOU 제거)
5. **[WARNING]** `room.service.ts`에서 `deleteByRoom` → Room 삭제 순서 트랜잭션 보장
6. **[WARNING]** 테스트 보완 (롤백, 트랜잭션 생명주기, `GameParticipant` 대상 검증)
7. **[WARNING]** 전체 `.roomId` 사용 지점 null 가드 검토
8. **[INFO]** 메서드명 `deleteByRoom` → `deleteInProgressGamesByRoom` 변경 검토
9. **[INFO]** N+1 쿼리 개선 (배치 INSERT, `getStartingChips()` 호이스팅)
10. **[INFO]** `@Index(['roomId', 'status'])` 복합 인덱스 추가 검토