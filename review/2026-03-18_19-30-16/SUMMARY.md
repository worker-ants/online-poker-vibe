# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 다단계 삭제 로직의 트랜잭션 부재, DB CASCADE와 수동 삭제 이중화, 동시성 경쟁 조건이 복합적으로 데이터 정합성을 위협함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/DB | `leaveRoom`의 다단계 삭제(`GameParticipant → Game → Room`)가 트랜잭션 없이 순차 실행. 중간 실패 시 고아(orphan) 레코드 발생. `createRoom`은 트랜잭션을 사용하고 있어 일관성 부재 | `room.service.ts:181-198` | `createQueryRunner()`로 전체 삭제 블록을 트랜잭션으로 래핑, 또는 DB CASCADE에 완전 위임하여 `roomRepository.remove(room)` 단일 호출로 단순화 |
| 2 | 동시성 | 두 플레이어가 동시에 퇴장할 경우 TOCTOU 경쟁 조건 발생 — 두 요청 모두 `roomPlayers.length === 0` 조건을 만족하여 삭제 로직 중복 실행 가능 | `room.service.ts:174-197` | 전체 `leaveRoom` 로직을 트랜잭션으로 묶거나 낙관적 락(버전 컬럼) 적용 |
| 3 | 아키텍처 | `RoomService`가 `GameParticipant` 삭제 순서까지 직접 관리 — Room 도메인이 Game 도메인 내부 구현을 알아야 하는 강한 결합 (SRP 위반) | `room.service.ts:183-197`, `room.module.ts:16` | `GameService.deleteByRoom(roomId)` 메서드를 추가하고 `RoomService`는 해당 메서드만 호출하도록 리팩토링 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DB/설계 | `onDelete: 'CASCADE'`와 수동 삭제 로직이 동시에 존재 — 동일 작업을 두 가지 방식으로 중복 수행하여 의도 불분명 | `game.entity.ts`, `game-participant.entity.ts`, `room.service.ts:183-195` | 하나의 전략으로 통일: CASCADE를 신뢰하면 수동 삭제 코드 제거, 수동 삭제를 유지하면 CASCADE 제거 |
| 2 | DB | SQLite는 기본적으로 외래키 비활성(`PRAGMA foreign_keys = OFF`) — `onDelete: 'CASCADE'` 선언이 있어도 실제 DB에서 무시될 수 있음. 이것이 원래 `FOREIGN KEY constraint failed` 오류의 근본 원인일 가능성 | TypeORM DataSource 설정 | `extra: { pragma: ["PRAGMA foreign_keys = ON;"] }` 추가 |
| 3 | DB | SQLite는 기존 FK 제약에 CASCADE 추가를 `ALTER TABLE`로 지원하지 않음. `synchronize: true` 상태에서 테이블 재생성 시 기존 데이터 유실 가능 | `game-participant.entity.ts`, `game.entity.ts` | 개발 환경임을 문서화하거나, `synchronize: false`로 전환 후 명시적 마이그레이션 사용 |
| 4 | 아키텍처 | `RoomModule`이 `GameModule`을 `forwardRef`로 이미 참조하면서, `Game`·`GameParticipant`를 `TypeOrmModule.forFeature()`에 직접 추가 등록 — 같은 엔티티를 두 모듈이 관리하는 소유권 혼재 | `room.module.ts:5-6, 16` | `GameModule`에서 Repository를 export하거나, `GameService`에 삭제 메서드를 추가하여 `RoomModule`이 직접 Game 엔티티를 등록하지 않도록 변경 |
| 5 | 테스팅 | `leaveRoom` 테스트가 `mockParticipantRepository`의 QueryBuilder 호출(`delete().where().execute()`)을 검증하지 않아 participant 삭제가 실제 호출되는지 확인 불가 | `room.service.spec.ts` | `mockQueryBuilder`를 별도 변수로 분리하고 `expect(mockQb.delete).toHaveBeenCalled()` 검증 추가 |
| 6 | 테스팅 | `mockParticipantRepository.createQueryBuilder`가 매 호출마다 새 객체를 반환하는 구조로 인해 체인 검증이 사실상 불가능 | `room.service.spec.ts:43-50` | `const mockQb = { delete: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn() }; createQueryBuilder: jest.fn(() => mockQb)` 패턴으로 단일 객체 참조 유지 |
| 7 | 테스팅 | 게임 기록이 없을 때(`games.length === 0`) 방 삭제가 정상 동작하는지 테스트 케이스 누락 | `room.service.spec.ts` | `mockGameRepository.find.mockResolvedValue([])` 시나리오 테스트 추가 |
| 8 | 동시성 | 호스트와 다른 플레이어가 동시에 퇴장 시, 이미 퇴장한 플레이어가 호스트로 지정될 수 있음 | `room.service.ts` 하단 host 이전 로직 | 호스트 이전 로직도 동일 트랜잭션 내에서 처리 |
| 9 | 보안 | Player 삭제 시 `GameParticipant`도 연쇄 삭제 — 명예의 전당 스펙상 게임 전적 영속성 정책과 충돌 가능 | `game-participant.entity.ts:37` `@ManyToOne(() => Player, ...)` | Player 삭제 정책 검토 후 `onDelete: 'SET NULL'`(+nullable 처리) 또는 `RESTRICT` 고려 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수 | `Card.tsx`의 `suitColor` fallback이 `'text-white'`로 남아 있어, clubs/spades의 `text-gray-900` 변경 취지와 불일치 | `Card.tsx:53` | fallback을 `'text-gray-900'`으로 변경하거나 TypeScript 타입으로 알 수 없는 suit 차단 |
| 2 | 문서화 | `onDelete: 'CASCADE'` 추가, `leaveRoom` 수동 삭제, `RoomModule`의 Game 엔티티 직접 등록에 대한 설계 의도 주석 부재 | 각 해당 위치 | 왜 CASCADE를 선택했는지, SQLite 환경 맥락, 모듈 구조 이유를 인라인 주석으로 명시 |
| 3 | 테스팅 | `onDelete: 'CASCADE'` DB 레벨 동작은 단위 테스트 mock으로 검증 불가 | - | SQLite in-memory를 사용하는 통합 테스트 추가 검토 |
| 4 | 테스팅 | `Card.tsx` 색상 변경(`text-white` → `text-gray-900`)에 대한 스냅샷/렌더링 테스트 부재 | `Card.tsx:22-23` | Storybook 스냅샷 또는 jest-dom 기반 렌더링 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | HIGH | SRP 위반 — RoomService의 Game 도메인 직접 관리, 트랜잭션 부재 |
| database | HIGH | 트랜잭션 없는 다단계 삭제, SQLite FK 기본 비활성화, CASCADE 미적용 가능성 |
| concurrency | HIGH | TOCTOU 경쟁 조건, 트랜잭션 부재로 인한 원자성 결여 |
| security | MEDIUM | 트랜잭션 부재로 인한 데이터 불일치, CASCADE/수동삭제 경쟁 조건 |
| testing | MEDIUM | participant 삭제 검증 누락, QueryBuilder mock 구조 불일치, 분기 테스트 누락 |
| performance | MEDIUM | 불필요한 수동 삭제 쿼리 3회 추가(CASCADE로 대체 가능), `remove(array)` N회 DELETE |
| scope | MEDIUM | 동일 문제를 두 방식으로 중복 해결, 모듈 결합도 증가 |
| dependency | MEDIUM | 모듈 경계 침범, 동일 엔티티 이중 등록 |
| requirement | MEDIUM | SQLite 기존 DB에 CASCADE 미반영 가능성, 트랜잭션 부재 |
| side_effect | MEDIUM | CASCADE/수동삭제 이중 실행, 트랜잭션 없는 순차 삭제 |
| maintainability | LOW | 두 삭제 전략 공존으로 의도 불분명 |
| api_contract | LOW | Room 삭제 시 Game 기록 함께 삭제되는 부수 효과 |
| documentation | LOW | CASCADE 설계 의도 주석 부재 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 하나 이상의 발견사항 보고)

---

## 권장 조치사항

1. **[즉시] 트랜잭션 적용** — `leaveRoom`의 삭제 로직 전체(`participant → game → room`)를 `createQueryRunner()` 트랜잭션으로 래핑하거나, DB CASCADE에 위임하여 `roomRepository.remove(room)` 단일 호출로 단순화
2. **[즉시] SQLite FK 활성화 확인** — TypeORM DataSource 설정에 `PRAGMA foreign_keys = ON` 추가. 이것이 원래 오류의 근본 원인일 가능성이 높음
3. **[즉시] CASCADE vs 수동 삭제 전략 통일** — 둘 중 하나만 선택. CASCADE가 실제 작동함이 확인되면 `room.service.ts`의 수동 삭제 블록 및 `room.module.ts`의 `Game`·`GameParticipant` 등록 제거
4. **[단기] `GameService.deleteByRoom(roomId)` 추출** — Game 도메인 삭제 책임을 `GameService`로 이전하여 `RoomService`의 SRP 위반 및 모듈 경계 침범 해소
5. **[단기] 테스트 보강** — `mockParticipantRepository` QueryBuilder를 단일 객체 참조로 수정 후 participant 삭제 검증 assertion 추가, games가 없는 케이스 테스트 추가
6. **[단기] Player CASCADE 정책 검토** — `GameParticipant`의 `@ManyToOne(() => Player, { onDelete: 'CASCADE' })`가 게임 전적 영속성 정책과 충돌하는지 확인 후 `SET NULL` 또는 `RESTRICT` 전환 여부 결정
7. **[단기] `Card.tsx` fallback 색상 수정** — `suitColor ?? 'text-white'` → `suitColor ?? 'text-gray-900'`으로 변경
8. **[선택] 동시 퇴장 경쟁 조건 대응** — 낙관적 락(버전 컬럼) 또는 트랜잭션 내 비관적 락으로 동시 방 삭제 중복 실행 방지