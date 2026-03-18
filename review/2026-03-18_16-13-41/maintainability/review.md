### 발견사항

---

**[WARNING] `PlayerController`의 쿠키 설정 로직 중복**
- 위치: `player.controller.ts`, `getMe()` 및 `setNickname()` 메서드
- 상세: 두 메서드에 UUID 생성 및 쿠키 설정 코드가 동일하게 반복됨. `COOKIE_NAME`, `COOKIE_MAX_AGE` 상수는 추출되었으나 쿠키 설정 블록 자체는 중복
- 제안: `private setCookieAndGetUuid(req, res): string` 헬퍼 메서드로 추출

---

**[WARNING] `RoomController`에서 `any` 캐스팅 사용**
- 위치: `room.controller.ts:19`
- 상세: `(req as any).cookies?.player_uuid` — `PlayerUuid` 커스텀 데코레이터가 이미 `common/decorators/`에 존재함에도 불구하고 사용되지 않음. 타입 안전성 저하
- 제안: `@PlayerUuid()` 데코레이터 활용

---

**[WARNING] `GameService.handleAction()` 메서드가 과도한 책임을 가짐**
- 위치: `game.service.ts:75-130`
- 상세: 액션 처리 → 핸드 완료 체크 → 칩 배분 → 게임 종료 판정 → DB 저장 → 결과 반환을 단일 메서드에서 수행. 순환 복잡도 높음
- 제안: `distributeWinnings()`, `checkGameOver()` 등으로 분리

---

**[WARNING] `HallOfFameService.getPlayerHistory()`에서 N+1 쿼리 발생**
- 위치: `hall-of-fame.service.ts:117-152`
- 상세: `for (const participation of participations)` 루프 내에서 매 iteration마다 `participantRepository.find()` 호출. 게임 수에 비례하여 DB 쿼리 폭발적 증가
- 제안: JOIN을 활용한 단일 쿼리로 통합 또는 gameId 배열을 `IN` 조건으로 일괄 조회

---

**[WARNING] `room.gateway.ts` diff 생략됨 — 잠재적 문제 미확인**
- 위치: `room/room.gateway.ts`
- 상세: 리뷰 대상에서 diff 내용이 생략됨. WebSocket 게이트웨이는 인증, 에러 핸들링, 메모리 관리 측면에서 유지보수성에 중요한 파일
- 제안: 별도 리뷰 필요

---

**[WARNING] `game.service.ts`의 `any` 타입 남용**
- 위치: `game.service.ts` — `getPublicState()`, `getActionRequired()`, `finishGame()`, `getGameResult()` 반환 타입
- 상세: 여러 public 메서드가 `any` 반환. 타입 변경 시 컴파일러가 오류를 잡지 못함
- 제안: `PublicGameState`, `ActionRequired` 등 공유 인터페이스 정의 후 적용

---

**[WARNING] `five-card-draw.engine.ts` diff 생략 — 변형 엔진 일관성 불확인**
- 위치: `game/engine/variants/five-card-draw.engine.ts`
- 상세: `texas-holdem.engine.ts`와 `seven-card-stud.engine.ts`는 리뷰 가능하나 five-card-draw는 생략됨. 세 엔진 간 패턴 일관성 검증 불가
- 제안: 공통 베이스 클래스(`AbstractPokerEngine`) 도입 검토

---

**[INFO] `DatabaseModule`에서 `synchronize: true` 하드코딩**
- 위치: `database.module.ts:11`
- 상세: 프로덕션 환경에서 `synchronize: true`는 데이터 손실 위험. 환경 변수 분기가 없음
- 제안: `synchronize: process.env.NODE_ENV !== 'production'`

---

**[INFO] `SevenCardStudEngine.advancePhase()`의 switch-case 중복**
- 위치: `seven-card-stud.engine.ts:259-297`
- 상세: `fourth-street`, `fifth-street`, `sixth-street` 케이스가 동일한 패턴(`visibleCards에 카드 1장 추가 → 다음 phase 설정 → findHighestVisibleHand`)을 반복
- 제안: 페이즈 순서 배열과 공통 deal 함수로 리팩터링

---

**[INFO] `game/game.service.ts` 내 `uuidv4` import 미사용**
- 위치: `game.service.ts:6`
- 상세: `uuidv4`를 import하나 `gameId`는 엔진의 `state.gameId`에서 가져옴. 불필요한 import
- 제안: import 제거

---

**[INFO] `frontend/app/game/[roomId]/page.tsx`의 useEffect 의존성 배열 과다**
- 위치: `page.tsx:108`
- 상세: useEffect 의존성 배열에 setter 함수들이 다수 포함됨. zustand의 stable setter는 의존성 배열에서 제외 가능하며, 현재 구조는 가독성 저하
- 제안: store hook을 `const store = useGameStore()` 형태로 통합하거나 selector를 별도 파일로 분리

---

**[INFO] `pot-calculator.ts`에서 `partialContributors` 변수 선언 후 미사용**
- 위치: `pot-calculator.ts:46-49`
- 상세: `partialContributors` 변수가 선언되고 할당되나 이후 로직에서 전혀 사용되지 않음. 데드 코드
- 제안: 해당 변수 제거 또는 의도한 로직 구현

---

### 요약

전반적으로 도메인 분리(`player`, `room`, `game`, `hall-of-fame`), 타입 시스템 활용(`common/types`), 테스트 코드 구비(`betting-round.spec.ts`, `deck.spec.ts`, `hand-evaluator.spec.ts`, `texas-holdem.engine.spec.ts`) 측면에서 유지보수성이 양호한 코드베이스입니다. 그러나 `GameService.handleAction()`의 단일 책임 원칙 위반, `HallOfFameService`의 N+1 쿼리 패턴, `any` 타입 남용, `PlayerController` 중복 코드, `DatabaseModule`의 `synchronize: true` 하드코딩 등의 이슈가 장기 유지보수성을 저해할 수 있습니다. 특히 `game.service.ts`의 반환 타입에 `any`가 광범위하게 사용되어 리팩터링 시 타입 안전성이 보장되지 않는 점이 핵심 위험 요소입니다.

### 위험도
**MEDIUM**