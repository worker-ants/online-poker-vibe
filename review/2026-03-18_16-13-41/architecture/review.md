### 발견사항

---

**[CRITICAL]** 게임 상태의 인메모리 관리
- 위치: `backend/src/game/game.service.ts:24` — `private activeGames = new Map<string, ActiveGame>()`
- 상세: 모든 활성 게임 상태가 서비스 인스턴스의 메모리에만 저장됨. 서버 재시작 시 진행 중인 모든 게임 소멸, 다중 인스턴스 배포 불가, 프로세스 크래시 시 복구 불가.
- 제안: 게임 상태를 Redis 또는 DB에 직렬화하여 영속화하거나, 최소한 체크포인트 복구 전략 수립 필요.

---

**[CRITICAL]** `synchronize: true` 프로덕션 위험
- 위치: `backend/src/database/database.module.ts:10`
- 상세: TypeORM의 `synchronize: true`는 엔티티 변경 시 자동으로 스키마를 수정함. 프로덕션 데이터 손실 위험이 있는 안티패턴.
- 제안: 마이그레이션 기반으로 전환하고, 환경별 분기 적용 (`synchronize: process.env.NODE_ENV !== 'production'`).

---

**[WARNING]** RoomModule ↔ GameModule 순환 의존성
- 위치: `backend/src/room/room.module.ts:9` — `forwardRef(() => GameModule)`
- 상세: `RoomGateway`가 `GameService`를 필요로 하고, `GameService`가 `Room` 엔티티를 직접 임포트하는 양방향 의존 구조. NestJS의 `forwardRef`는 순환 의존성 해소가 아닌 임시 회피책.
- 제안: `GameModule`이 `Room` 엔티티를 직접 임포트하지 않도록 `RoomService`를 통해 간접 접근하거나, 게임 시작 로직을 독립 오케스트레이터 레이어(예: `GameSessionModule`)로 분리.

---

**[WARNING]** `NicknameRequiredGuard`의 잘못된 의존 방향
- 위치: `backend/src/common/guards/nickname-required.guard.ts:8`
- 상세: `common` 레이어가 `player` 피처 모듈에 의존. 레이어 계층이 역전됨 (공통 모듈 → 도메인 모듈).
- 제안: Guard를 `PlayerModule` 내부로 이동하거나, 인터페이스/토큰(`IPlayerService`)을 `common`에 정의하고 DI로 주입.

---

**[WARNING]** `GameService`의 다중 책임 (SRP 위반)
- 위치: `backend/src/game/game.service.ts` 전체
- 상세: 엔진 인스턴스 관리, 인메모리 상태 관리, 게임 진행 로직, DB 영속화, 결과 집계를 단일 클래스에서 처리. 282줄이며 계속 증가할 구조.
- 제안: `GameSessionManager`(인메모리 상태), `GamePersistenceService`(DB), `GameResultService`(집계)로 분리.

---

**[WARNING]** `HallOfFameModule`이 타 모듈 엔티티를 직접 임포트
- 위치: `backend/src/hall-of-fame/hall-of-fame.module.ts:4-6`
- 상세: `Game`, `GameParticipant`, `Player` 엔티티를 HallOfFame 모듈이 직접 소유. 모듈 경계 위반으로, 해당 엔티티 스키마 변경 시 HallOfFame도 영향 받음.
- 제안: `GameModule`과 `PlayerModule`이 각각 Repository를 export하거나, 전용 조회 서비스(query facade)를 export하여 HallOfFame이 해당 서비스에만 의존하도록 설계.

---

**[WARNING]** `PokerEngineFactory`의 OCP 위반
- 위치: `backend/src/game/engine/poker-engine.factory.ts:14-24`
- 상세: 새 포커 변형 추가 시 `switch` 문 수정 필요. 개방-폐쇄 원칙 위반.
- 제안: 엔진 레지스트리 패턴 적용 — `Map<PokerVariant, () => IPokerEngine>` 형태로 등록/조회.

---

**[WARNING]** 컨트롤러 레이어의 비즈니스 로직
- 위치: `backend/src/player/player.controller.ts:15-28, 41-52`
- 상세: UUID 생성(`uuidv4()`)과 쿠키 설정 로직이 `getMe`와 `setNickname` 양쪽에 중복. 쿠키 관리는 비즈니스 정책으로 서비스 또는 미들웨어로 이동 필요.
- 제안: UUID 발급 및 쿠키 설정을 미들웨어나 인터셉터로 분리, `PlayerService.findOrCreate`를 통해 처리.

---

**[WARNING]** 엔티티에 도메인 메서드 혼재
- 위치: `backend/src/room/room.entity.ts:54-60` — `getSettings()`, `setSettings()`
- 상세: TypeORM 엔티티(데이터 매핑 객체)가 JSON 파싱 로직을 포함. Anemic Domain Model과 Rich Entity 패턴이 혼재하며, `settings`가 문자열로 저장되는 구현 세부 사항이 노출됨.
- 제안: `settings`를 TypeORM의 `simple-json` 컬럼 타입으로 변경하거나, 변환 로직을 서비스 레이어로 이동.

---

**[WARNING]** `GameService` 공개 메서드의 광범위한 `any` 타입 사용
- 위치: `backend/src/game/game.service.ts` — `getPublicState(): any`, `getActionRequired(): any`, `handleAction()` 반환값 내 `showdown?: any`
- 상세: 타입 안전성 부재로 컴파일 타임 오류 감지 불가. 서비스-게이트웨이 간 계약이 암묵적.
- 제안: 공개 상태, 액션 요청, 쇼다운 결과에 대한 명시적 DTO/인터페이스 정의.

---

**[INFO]** 변형 엔진 클래스의 인스턴스 상태
- 위치: `backend/src/game/engine/variants/texas-holdem.engine.ts:21`, `seven-card-stud.engine.ts:21`
- 상세: `private deck = new Deck()`이 클래스 인스턴스 수준에서 선언됨. `PokerEngineFactory`가 매번 새 인스턴스를 생성하므로 현재는 문제 없으나, 싱글톤으로 전환 시 게임 간 상태 공유 버그 발생 가능.
- 제안: `deck`을 `startHand` 호출 시 로컬 생성하거나, 엔진 클래스를 명확히 stateless로 설계.

---

**[INFO]** `GameState.deck` 필드가 공개 상태에 노출될 위험
- 위치: `backend/src/common/types/game.types.ts:83`
- 상세: `GameState`에 `deck: Card[]`가 포함되어 있어 직렬화 시 전체 덱이 클라이언트에 전송될 수 있음.
- 제안: 공개 상태 DTO에서 `deck` 필드를 명시적으로 제외하거나, 내부 엔진 상태와 공개 상태를 별도 타입으로 분리.

---

### 요약

전체적으로 NestJS 모듈 시스템, Strategy + Factory 패턴, WebSocket 게이트웨이 분리 등 견고한 아키텍처 골격을 갖추고 있다. 게임 엔진 레이어(`IPokerEngine`, `IGameMode`, `BettingRound`, `HandEvaluator`)의 관심사 분리는 특히 잘 설계되어 있다. 그러나 현재 구조에는 두 가지 구조적 위험이 존재한다: 첫째, 게임 상태가 단일 서버 메모리에만 존재하여 장애 복구와 수평 확장이 불가능하고, 둘째 RoomModule ↔ GameModule 순환 의존성과 `common`이 피처 모듈에 의존하는 레이어 역전이 모듈 경계를 약화시키고 있다. `any` 타입 남용과 `GameService`의 책임 과부하도 유지보수성을 저하시키는 요인이다.

### 위험도

**HIGH**