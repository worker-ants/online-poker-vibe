### 발견사항

---

**[CRITICAL] `resolveHand` 로직이 세 엔진에 완전히 중복됨**
- 위치: `texas-holdem.engine.ts`, `five-card-draw.engine.ts`, `seven-card-stud.engine.ts` — `resolveHand` 메서드
- 상세: 팟 계산 → 핸드 평가 → 타이 처리 → 위너 배분 → fallback 로직이 세 파일에 거의 동일하게 복사되어 있음. 버그 수정 시 세 곳 모두 수정해야 하며, 누락 가능성이 높음.
- 제안: `BasePokerEngine` 추상 클래스를 도입하거나 `HandResolver` 도메인 서비스를 별도로 추출하여 공통 로직을 단일화.

---

**[CRITICAL] 엔진 인스턴스가 상태를 가지면서 상태 패싱 인터페이스와 충돌**
- 위치: 세 엔진 클래스 상단 `private deck = new Deck()` 외 collaborator 필드들
- 상세: `IPokerEngine` 인터페이스는 `GameState`를 매개변수로 주고받는 순수 함수형 설계를 표방하지만, 실제 구현체는 `Deck` 인스턴스를 필드로 가짐. `GameService`가 엔진을 룸 단위로 하나씩 보관하므로 현재는 동작하나, 엔진이 재사용되거나 멀티 스레드 환경에서 `deck.reset()/shuffle()` 호출이 경쟁 조건을 유발할 수 있음.
- 제안: `Deck` 생성을 `startHand` 내부에서 지역 변수로 처리하거나, `GameState`에 덱 상태를 완전히 포함시켜 엔진을 완전한 순수 함수형(stateless)으로 전환.

---

**[WARNING] `GameService`가 SRP를 위반하는 God Object**
- 위치: `game.service.ts` 전체
- 상세: 단일 클래스가 ① 인메모리 게임 상태 관리(`activeGames` Map), ② DB 영속성(트랜잭션 처리), ③ 핸드 결과 정산, ④ 칩 분배, ⑤ 게임 종료 처리, ⑥ AI 액션 필터링까지 담당. 변경 이유가 너무 많아 유지보수 시 사이드이펙트 위험이 큼.
- 제안: `GameStateManager`(인메모리 상태), `GamePersistenceService`(DB 처리), `HandResultService`(결과 정산)로 분리. `GameService`는 이들을 조율하는 파사드 역할만 담당.

---

**[WARNING] Room ↔ Game 모듈 순환 의존성**
- 위치: `room.module.ts`의 `forwardRef(() => GameModule)`, `game.service.ts`의 `import { Room } from '../room/room.entity.js'`
- 상세: `RoomModule`이 `GameModule`을 참조하고, `GameService`가 `Room` 엔티티를 직접 임포트하여 역방향 참조가 형성됨. `forwardRef`는 이를 해결하는 게 아니라 숨기는 것.
- 제안: `GameService.startGame()`의 파라미터를 `Room` 엔티티 대신 `GameStartDto` 인터페이스로 추상화하여 `game` 모듈이 `room` 모듈에 의존하지 않도록 경계 정의.

---

**[WARNING] `findNextActive` 헬퍼 함수 중복**
- 위치: `texas-holdem.engine.ts:findNextActivePlayerIndex`, `five-card-draw.engine.ts:findNextActive`
- 상세: 함수명이 다르지만 로직이 동일함. 변경 시 누락 위험 존재.
- 제안: `engine-utils.ts`로 추출하여 공유.

---

**[WARNING] 기본 블라인드 스케줄 비즈니스 규칙이 팩토리에 하드코딩**
- 위치: `poker-engine.factory.ts:createMode` — `settings.blindSchedule ?? [...]`
- 상세: 토너먼트 기본 블라인드 레벨 정의는 게임 규칙(도메인 지식)인데 인프라 레이어(팩토리)에 위치함. 룰 변경 시 팩토리를 수정해야 함.
- 제안: `DEFAULT_TOURNAMENT_BLIND_SCHEDULE` 상수를 도메인 타입 파일(`game.types.ts`)이나 별도 설정 파일로 이동.

---

**[WARNING] `Room` 엔티티에 비즈니스 로직 포함**
- 위치: `room.entity.ts:getSettings()`, `setSettings()`
- 상세: 엔티티가 JSON 파싱/직렬화 책임을 가짐. TypeORM Repository 패턴에서 엔티티는 데이터 구조만 정의해야 하며, 변환 로직은 서비스 레이어가 담당해야 함. Active Record vs Data Mapper 패턴 혼용.
- 제안: TypeORM의 `@Transform` 또는 커스텀 컬럼 트랜스포머를 사용하거나, 서비스에서 직접 JSON 파싱 처리.

---

**[INFO] `JSON.parse(JSON.stringify())` 딥 복사 패턴 남용**
- 위치: 세 엔진의 `startHand`, `handleAction`, `advancePhase` 등 다수
- 상세: 타입 정보가 소실되고 성능이 떨어짐. `Date` 등 비직렬화 타입이 `GameState`에 추가될 경우 무음 실패 발생.
- 제안: `structuredClone()` (Node 17+) 사용 또는 명시적 타입 보존 복사 유틸리티 도입.

---

**[INFO] 인메모리 `activeGames`로 인한 수평 확장 불가**
- 위치: `game.service.ts:activeGames` Map
- 상세: 서버 재시작 시 진행 중인 게임 상태가 유실됨(`onModuleInit`에서 DB를 `abandoned`로 처리하는 것이 이를 반증). 멀티 인스턴스 배포 불가.
- 제안: 현재 규모에서는 허용 가능하나, 향후 Redis 또는 DB 기반 상태 저장으로 마이그레이션할 수 있도록 `IGameStateStore` 인터페이스로 추상화.

---

**[INFO] 엔진 내부 collaborator가 직접 생성됨 (DI 미적용)**
- 위치: 세 엔진 클래스의 `private handEvaluator = new HandEvaluator()` 등
- 상세: `HandEvaluator`, `BettingRound`, `PotCalculator`가 `new`로 직접 생성되어 테스트 시 모킹 불가. 현재는 테스트가 실제 구현체를 사용하므로 문제 없으나 설계 일관성이 부족.
- 제안: NestJS DI를 활용하거나 생성자 주입 패턴 적용.

---

### 요약

전반적으로 `IPokerEngine`/`IGameMode` 인터페이스 기반의 전략 패턴, 팩토리 패턴 적용은 잘 설계되어 있으며 세 가지 포커 변형과 두 게임 모드의 확장성을 잘 지원한다. 그러나 `resolveHand` 로직의 3중 복사 및 엔진 내 상태 필드(`Deck`) 혼재가 가장 심각한 구조적 결함으로, 이 두 문제는 버그 발생 시 동기화 오류나 추적 불가능한 사이드이펙트로 직결된다. `GameService`의 God Object화와 Room ↔ Game 순환 의존성은 향후 기능 추가 시 유지보수 부채를 누적시킬 것이므로 조기 리팩토링이 권장된다.

### 위험도

**HIGH**