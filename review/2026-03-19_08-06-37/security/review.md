## 보안 코드 리뷰

### 발견사항

---

- **[INFO]** `roomId` Nullable 변경으로 인한 데이터 무결성 경계 확장
  - 위치: `game.entity.ts:21-22`
  - 상세: `roomId`가 `NOT NULL → nullable: true`로 변경되어 게임 레코드가 Room 없이 존재할 수 있습니다. `onDelete: 'SET NULL'` 조합으로 의도된 설계이나, `roomId = null`인 게임을 실수로 쿼리 대상에 포함하는 코드가 추가될 경우 의도치 않은 데이터 노출 가능성이 생깁니다.
  - 제안: `roomId`가 null인 게임을 처리하는 코드 경로에 명시적 필터링 조건 추가 검토

---

- **[INFO]** `deleteByRoom` 메서드 내 인가(Authorization) 검증 부재
  - 위치: `game.service.ts:376-399`
  - 상세: `deleteByRoom(roomId)`는 내부에 인가 검증 로직이 없으며, 호출자가 권한을 사전에 검증했다고 신뢰합니다. 서비스 레이어가 컨트롤러 또는 게이트웨이에서 직접 노출될 경우, 다른 사용자의 Room에 속한 게임을 삭제할 수 있는 우회 경로가 될 수 있습니다.
  - 제안: 메서드 호출 전 호출자(Room Gateway/Controller)에서 요청자가 해당 Room의 Host인지 검증하는지 확인 필요. 서비스 레이어에 방어적 주석 또는 Guard 추가 권장

---

- **[INFO]** TypeORM QueryBuilder의 IN절 파라미터화 — 안전 확인
  - 위치: `game.service.ts:390-394`
  - 상세: `'gameId IN (:...gameIds)'` 구문은 TypeORM의 파라미터화 쿼리를 사용하므로 SQL 인젝션으로부터 안전합니다. `gameIds`가 DB에서 조회된 값임도 추가적인 안전 요소입니다.
  - 제안: 해당 없음 (양호)

---

- **[INFO]** 에러 재전파 시 DB 내부 정보 노출 가능성
  - 위치: `game.service.ts:396-398` (catch 블록)
  - 상세: `throw err`로 DB 예외가 그대로 상위로 전파됩니다. TypeORM/SQLite 에러에는 테이블명, 컬럼명, 쿼리 내용이 포함될 수 있으며, 이것이 클라이언트에 그대로 노출될 경우 정보 유출이 됩니다. 이 패턴은 기존 코드에도 존재하며 이번 변경에서 도입된 것은 아닙니다.
  - 제안: Gateway/Controller 레이어에서 DB 에러를 일반화된 메시지로 변환하는 Exception Filter 적용 권장

---

- **[INFO]** 테스트 코드의 `any` 타입 캐스팅
  - 위치: `game.service.spec.ts:20-28` (`makeRoom` 내부)
  - 상세: `as any` 캐스팅이 다수 사용되어 타입 안전성이 제거됩니다. 테스트 환경이므로 직접적인 보안 위협은 아니나, 타입 불일치로 인한 테스트의 신뢰성 저하로 이어질 수 있습니다.
  - 제안: 테스트용 타입 픽스처를 명확히 정의하거나 `Partial<T>` 활용

---

### 요약

이번 변경은 명예의 전당 데이터 보존을 위해 `Game` 엔티티의 `roomId`를 nullable로 전환하고, `deleteByRoom` 로직을 `in-progress` 게임에만 한정하는 내용입니다. 보안 관점에서 SQL 인젝션 등 OWASP Top 10의 주요 취약점에 해당하는 이슈는 발견되지 않았습니다. 다만 `deleteByRoom` 메서드의 인가 검증이 호출자 레이어에 전적으로 위임되어 있어, 해당 경로에서의 권한 검증 일관성을 확인할 필요가 있습니다. 에러 전파로 인한 DB 정보 노출은 기존 코드 전반의 문제로 Exception Filter를 통한 중앙 처리가 권장됩니다.

### 위험도

**LOW**