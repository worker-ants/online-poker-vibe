바이브 코딩을 진행하며 수행된 작업 및 프롬프트의 기록입니다.

# Action
## 템플릿 삭제
- `README.md` 삭제
- `backend/` 삭제
- `frontend/` 삭제

## 프레임워크 설치
- backend: nest.js
- frontend: next,js

```shell
nest new backend
npx create-next-app@latest frontend --yes
```

# Turn 1
```text
온라인 포커 게임을 구현해야 합니다.

# 보안
- 클라이언트의 데이터는 신뢰할 수 없으므로 모든 비즈니스 로직의 처리는 백엔드에서 이루어져야 합니다.
- 실시간 처리 구현을 위한 방식은 웹소켓을 사용해 주세요.
- 유저의 식별은 secure cookie에 uuid를 저장하여 식별해 주세요.

# 타이틀 페이지
클라이언트에서 표시되는 타이틀 페이지는 다음 요소로 구성됩니다.:
- 현재 join 가능한 대기상태(게임 시작 전)의 room 목록
- 닉네임 설정
- room 생성
- 명예의 전당

닉네임 관련 정책:
- 새로고침시에도 설정한 닉네임 유지
- 다른 클라이언트가 사용한 닉네임은 설정할 수 없음
- 닉네임 설정 전에는 room을 생성하거나 join 할 수 없음
- 닉네임은 변경이 가능하며, 변경한 경우에는 기존의 게임 히스토리도 변경후의 닉네임으로 표기 필요

클라이언트 식별 정책:
- 클라이언트는 cookie에 uuid와 같은 고유한 키를 할당하여 식별합니다.
- 하나의 클라이언트는 동시에 하나의 게임에만 접속이 가능합니다. (동시에 여러 room에 join 할 수 없습니다.)

# 게임 화면
게임 화면의 기본 레이아웃은 다음과 같습니다.
- 상단 네비게이션: 자신의 닉네임, 게임 도움말(설명서)
    - 도움말은 modal 형태로 표시되어야 합니다.
- 좌측 화면: 자신의 게임 화면
- 우측 화면: 같이 게임을 진행중인 유저의 목록, 게임 포기와 같은 컨트롤 버튼 등의 UI 구성

# 플레이 방식
room을 생성하거나 join한 경우, 게임은 즉시 시작되지 않습니다.
플레이어는 "준비 완료" 버튼을 눌러, 자신이 게임을 시작할 의사가 있음을 표시할 수 있습니다.
- 게임 시작 전에는 room을 생성한 host 유저는 다른 guest 유저를 추방할 수 있습니다.
- 게임 시작 전에는 준비 완료를 철회할 수 있습니다.

게임을 시작하기 위한 최소한의 플레이어의 수가 충족되었고, 모든 플레이어가 "준비 완료" 상태가 된 후에는 게임을 시작합니다.
게임 룰은 일반적인 포커 게임의 룰을 그대로 적용하세요.

# 명예의 전당 페이지
순위를 볼 수 있는 페이지입니다.
플레이어를 기준으로 순위를 표시합니다.

목록에서 표시되는 항목:
- 플레이어의 닉네임
- 승리한 게임 수
- 비긴 게임 수
- 패배한 게임 수
- 게임중 중도 이탈 수
- 승률 (전체 게임 수에서 승리한 게임 수의 비율. 소수점 2번째 자리까지 표기)
- 마지막 게임 시간 (YYYY-mm-dd HH:ii:ss)

순위 표시의 기준 (우선순위):
1. 승리한 게임 수가 많은 플레이어
2. 비긴 게임 수가 많은 플레이어
3. 패배한 게임 수가 적은 플레이어 (중도 이탈 수도 패배로 간주)
4. 마지막 게임 시간이 빠른 플레이어

목록에서 플레이어를 선택할 경우, modal로 해당 플레이어의 게임 전적을 모두 표기합니다.
- 게임 시간
- 같이 플레이를 진행한 플레이어와 각각의 플레이어들의 순위

# 계획 과정에서 진행해야 할 사항
전반적인 내용 및 순위 표시 규칙에 더 좋은 방법이 있을 경우, 제안을 하십시오.
```

```text
Review your answers

 ● 포커 게임의 변형은 어떤 것을 사용할까요?
   → room 생성시 게임 룰을 선택할 수 있도록 처리해 주세요. room 목록에서도 룰이 표기되어야 합니다.
 ● 한 room의 최대 플레이어 수는 몇 명으로 할까요?
   → 6명 (추천)
 ● 칩/베팅 시스템은 어떻게 구성할까요? (한 '게임'의 단위도 결정됩니다)
   → room 생성시 선택 가능하도록 처리해 주세요.
 ● 순위 시스템에 대해 몇 가지 개선 제안이 있습니다. 현재 기준에서 '비김(draw)'은 포커에서 드문 경우이고, '마지막 게임 시간이 빠른 플레이어'가 상위인 것은 직관적이지 않을 수
 있습니다. 어떻게 할까요?
   → 개선안 적용
```

```text
Review your answers

 ● 데이터 저장소는 어떤 것을 사용할까요? 게임 전적, 닉네임, 명예의 전당 등의 데이터를 영속적으로 저장해야 합니다.
   → SQLite (추천)
 ● Room 생성 시 선택 가능한 포커 변형을 모두 구현하면 범위가 매우 커집니다. 어떤 변형들을 지원할까요?
   → 3가지 모두 구현
 ● Room 생성 시 선택 가능한 게임 방식도 모두 구현하면 범위가 커집니다. 어떤 방식을 우선 지원할까요?
   → 토너먼트 + 캐시 모두
```

```text
 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Online Poker Game - Implementation Plan

 Context

 온라인 멀티플레이어 포커 게임을 처음부터 구현합니다. 현재 backend(NestJS 11)와 frontend(Next.js 16)의 기본 스캐폴드만 존재하며, 비즈니스 로직은 없습니다. SDD/TDD 방법론에 따라
 스펙 작성 → 테스트 작성 → 구현 → 리뷰 순서로 진행합니다.

 핵심 요구사항:
 - 3가지 포커 변형: Texas Hold'em, 5 Card Draw, 7 Card Stud
 - 2가지 게임 모드: Tournament, Cash Game
 - Room 생성 시 변형/모드 선택 가능
 - 최대 6명, 최소 2명
 - WebSocket 실시간 통신, Secure Cookie UUID 인증
 - 명예의 전당 (개선된 순위 시스템)

 ---
 Phase 1: Spec 문서 작성

 SDD에 따라 먼저 spec/ 디렉토리에 상세 스펙 문서를 작성합니다.

 작성할 스펙 문서:

 - spec/01-architecture.md — 전체 시스템 아키텍처, 기술 스택, 통신 방식
 - spec/02-database.md — DB 스키마 (Player, Room, RoomPlayer, Game, GameParticipant)
 - spec/03-player-identity.md — UUID 쿠키 기반 인증, 닉네임 정책
 - spec/04-room-system.md — Room CRUD, join/leave/kick/ready, 상태 머신
 - spec/05-poker-engine.md — 3가지 변형의 게임 룰, 핸드 랭킹, 베팅 라운드
 - spec/06-game-modes.md — Tournament vs Cash Game 모드 차이점
 - spec/07-websocket-events.md — 모든 WebSocket 이벤트 정의 (Client↔Server)
 - spec/08-hall-of-fame.md — 순위 시스템, 전적 조회
 - spec/09-frontend-ui.md — 페이지 구성, 컴포넌트 구조, 레이아웃

 ---
 Phase 2: Backend Foundation

 2-1. 의존성 설치

 @nestjs/websockets @nestjs/platform-socket.io socket.io
 @nestjs/typeorm typeorm better-sqlite3
 @nestjs/config cookie-parser uuid
 class-validator class-transformer
 # Dev: @types/cookie-parser @types/uuid @types/better-sqlite3

 2-2. Database 설정

 - src/database/database.module.ts — TypeORM + SQLite 설정
 - SQLite 파일: backend/data/poker.sqlite

 2-3. DB 스키마 (TypeORM Entities)

 Player — uuid (PK), nickname (UNIQUE, NULLABLE), createdAt, updatedAt

 Room — id (UUID PK), name, variant (texas-holdem/five-card-draw/seven-card-stud), mode (tournament/cash), status (waiting/playing/finished), hostUuid (FK→Player), maxPlayers,
 settings (JSON), createdAt

 RoomPlayer — id, roomId (FK→Room), playerUuid (FK→Player), seatIndex, isReady, joinedAt

 Game — id (UUID PK), roomId (FK→Room), variant, mode, status (in-progress/completed/abandoned), startedAt, finishedAt

 GameParticipant — id, gameId (FK→Game), playerUuid (FK→Player), result (win/loss/draw/abandoned), chipsDelta, finalChips, placement

 2-4. Player Module

 - src/player/player.entity.ts
 - src/player/player.service.ts — UUID 쿠키 생성, 닉네임 CRUD, 중복 체크
 - src/player/player.controller.ts — POST /player/nickname, GET /player/me
 - Secure cookie middleware in main.ts

 2-5. 모듈 구조

 backend/src/
 ├── main.ts                          # Cookie parser, CORS, 포트 설정
 ├── app.module.ts                    # 루트 모듈
 ├── common/
 │   ├── decorators/player-uuid.decorator.ts
 │   ├── guards/nickname-required.guard.ts
 │   ├── guards/ws-auth.guard.ts
 │   └── types/                       # Card, GamePhase, Action 등 공유 타입
 ├── database/database.module.ts
 ├── player/                          # 인증 + 닉네임
 ├── room/                            # Room CRUD + WebSocket
 ├── game/
 │   ├── engine/                      # 순수 포커 엔진 (NestJS 무의존)
 │   │   ├── poker-engine.interface.ts
 │   │   ├── poker-engine.factory.ts
 │   │   ├── game-state.ts
 │   │   ├── deck.ts
 │   │   ├── hand-evaluator.ts
 │   │   ├── betting-round.ts
 │   │   ├── pot-calculator.ts
 │   │   ├── variants/
 │   │   │   ├── texas-holdem.engine.ts
 │   │   │   ├── five-card-draw.engine.ts
 │   │   │   └── seven-card-stud.engine.ts
 │   │   └── modes/
 │   │       ├── game-mode.interface.ts
 │   │       ├── cash-game.mode.ts
 │   │       └── tournament.mode.ts
 │   ├── game.module.ts
 │   ├── game.service.ts              # 오케스트레이터
 │   ├── game.gateway.ts              # WebSocket
 │   ├── game-result.entity.ts
 │   └── game-participant.entity.ts
 └── hall-of-fame/                    # 순위 + 전적 조회

 ---
 Phase 3: Poker Engine (TDD - 핵심)

 순수 TypeScript로 구현. NestJS 의존 없음. 독립적으로 테스트 가능.

 3-1. 공유 컴포넌트

 - Deck — 셔플, 딜 (Fisher-Yates shuffle)
 - HandEvaluator — 최적의 5장 핸드 평가 (Royal Flush ~ High Card). 모든 변형이 공유
   - Hold'em: 7장(2홀+5커뮤니티)에서 최적 5장
   - Draw: 5장 그대로
   - Stud: 7장에서 최적 5장
 - BettingRound — check/call/raise/fold/all-in 로직. 모든 변형이 공유
 - PotCalculator — 사이드 팟 계산

 3-2. IPokerEngine 인터페이스

 interface IPokerEngine {
   variant: PokerVariant;
   initialize(players, mode): GameState;
   startHand(state): GameState;
   handleAction(state, playerUuid, action): GameState;
   getValidActions(state, playerUuid): PlayerAction[];
   isHandComplete(state): boolean;
   resolveHand(state): HandResult;
 }

 3-3. 변형별 페이즈 머신

 - Texas Hold'em: WAITING → PRE_FLOP → FLOP → TURN → RIVER → SHOWDOWN
 - 5 Card Draw: WAITING → ANTE → FIRST_BET → DRAW → SECOND_BET → SHOWDOWN
 - 7 Card Stud: WAITING → THIRD_STREET → FOURTH_STREET → FIFTH_STREET → SIXTH_STREET → SEVENTH_STREET → SHOWDOWN

 3-4. 게임 모드

 - Tournament: 동일 시작 칩, 블라인드 점진 상승, 탈락제, 입퇴장 불가
 - Cash Game: 고정 블라인드, 자유 입퇴장, 핸드 사이 join 가능

 3-5. 핵심 설계 결정

 - Strategy Pattern: 변형별 엔진이 IPokerEngine 구현 + 공유 유틸리티(Deck, HandEvaluator, BettingRound) 조합
 - Immutable-style GameState: 매 전환 시 새 상태 반환 → 테스트 용이
 - Active 게임 상태는 메모리(Map<roomId, GameState>), 결과만 DB 저장

 ---
 Phase 4: Room & Game Integration

 4-1. Room Module

 - room.entity.ts, room.service.ts, room.controller.ts
 - REST: GET /rooms (대기 중 목록), POST /rooms (생성)
 - room.gateway.ts — WebSocket: join, leave, ready, kick, start

 4-2. Game Module

 - game.service.ts — 엔진 생성, 게임 라이프사이클 관리, 결과 저장
 - game.gateway.ts — WebSocket: game actions (bet, fold, call, raise, draw)
 - 액션 타이머: 일정 시간 내 미응답 시 auto-fold

 4-3. WebSocket 이벤트 요약

 Client → Server:

 ┌─────────────┬───────────────────────────────────────────────┐
 │    Event    │                     설명                      │
 ├─────────────┼───────────────────────────────────────────────┤
 │ room:join   │ Room 입장                                     │
 ├─────────────┼───────────────────────────────────────────────┤
 │ room:leave  │ Room 퇴장                                     │
 ├─────────────┼───────────────────────────────────────────────┤
 │ room:ready  │ 준비 완료 토글                                │
 ├─────────────┼───────────────────────────────────────────────┤
 │ room:kick   │ Host가 Guest 추방                             │
 ├─────────────┼───────────────────────────────────────────────┤
 │ game:action │ 베팅 액션 (fold/check/call/raise/all-in/draw) │
 └─────────────┴───────────────────────────────────────────────┘

 Server → Client:

 ┌──────────────────────┬─────────────────────────────────────────┐
 │        Event         │                  설명                   │
 ├──────────────────────┼─────────────────────────────────────────┤
 │ room:updated         │ Room 상태 변경                          │
 ├──────────────────────┼─────────────────────────────────────────┤
 │ game:state           │ 공개 게임 상태                          │
 ├──────────────────────┼─────────────────────────────────────────┤
 │ game:private         │ 개인 핸드 카드 (소켓별 전송)            │
 ├──────────────────────┼─────────────────────────────────────────┤
 │ game:action-required │ 현재 턴 플레이어에게 유효 액션 + 타이머 │
 ├──────────────────────┼─────────────────────────────────────────┤
 │ game:showdown        │ 핸드 공개 + 승자                        │
 ├──────────────────────┼─────────────────────────────────────────┤
 │ game:ended           │ 게임 종료 결과                          │
 └──────────────────────┴─────────────────────────────────────────┘

 4-4. 인증 흐름

 1. 최초 접속 시 middleware가 player_uuid secure httpOnly 쿠키 확인
 2. 없으면 UUIDv4 생성 → Player 엔티티 생성 → 쿠키 설정
 3. WebSocket 연결 시 handshake에서 쿠키 추출하여 소켓에 UUID 바인딩
 4. 닉네임 미설정 시 room join/create 차단 (NicknameRequiredGuard)

 ---
 Phase 5: Frontend

 5-1. 의존성 설치

 socket.io-client zustand

 5-2. 디렉토리 구조

 frontend/
   app/
     layout.tsx                     # Providers (Socket, Identity, Toast)
     page.tsx                       # 타이틀 페이지 (로비)
     game/[roomId]/page.tsx         # 게임 화면
     hall-of-fame/page.tsx          # 명예의 전당
   components/
     lobby/                         # RoomList, RoomCard, CreateRoomModal, NicknameInput
     game/
       GameLayout.tsx               # 2패널 레이아웃
       TopNav.tsx                   # 닉네임 + 도움말
       HelpModal.tsx                # 게임 규칙 모달 (변형별)
       table/                       # PokerTable, CommunityCards, PotDisplay, PlayerSeat, CardFan
       sidebar/                     # PlayerList, BettingControls, ReadyButton, ForfeitButton
     cards/                         # Card, CardBack (CSS/유니코드 기반)
     hall-of-fame/                  # RankingsTable, PlayerHistoryModal
     shared/                        # Modal, Button, Toast
   lib/
     socket.ts                      # Socket.IO 싱글톤
     types.ts                       # 공유 타입
     constants.ts                   # 이벤트명, 변형 설정
   hooks/                           # useSocket, useGameState, useRoomList, useIdentity, useCountdown
   providers/                       # SocketProvider, IdentityProvider, ToastProvider

 5-3. 상태 관리

 - React Context: Socket 인스턴스, Identity (playerId + nickname), Toast — 변경 빈도 낮음
 - Zustand Store: GameState, RoomList — 변경 빈도 높음, 컴포넌트별 slice 구독으로 리렌더 최소화

 5-4. 페이지 구성

 타이틀 페이지:
 - 닉네임 입력/변경 위젯
 - Room 생성 버튼 → 모달 (변형/모드/설정 선택)
 - 대기 중 Room 목록 (변형, 모드, 인원수, 호스트 표시)
 - 명예의 전당 링크

 게임 화면:
 - 상단: 닉네임 + 도움말 모달
 - 좌측: 포커 테이블 (변형에 따라 적응 — 커뮤니티 카드 유무, 카드 수 등)
 - 우측: 플레이어 목록, 베팅 컨트롤, 준비/포기 버튼

 명예의 전당:
 - 순위 테이블 (닉네임, 승/무/패/이탈, 승률, 마지막 게임)
 - 플레이어 클릭 → 모달로 전체 전적 표시

 5-5. 카드 렌더링

 - CSS/HTML + 유니코드 심볼 (♠♥♦♣) 기반, 이미지 불필요
 - 앞/뒷면 전환 애니메이션 (CSS rotateY)
 - CardFan: 카드 부채꼴 배치 (Hold'em 2장, Draw 5장, Stud 7장)
 - Draw 변형: 카드 클릭으로 교환 대상 선택

 ---
 Phase 6: Hall of Fame (명예의 전당)

 6-1. 개선된 순위 기준

 1. 승률 (wins / totalGames) — 높을수록 상위
 2. 승리 수 — 많을수록 상위
 3. 총 게임 수 — 많을수록 상위 (경험 반영)
 4. 최근 게임 시간 — 최근일수록 상위

 - "비김(draw)" = Split Pot 발생 횟수
 - "이탈(abandoned)" = 패배로 간주하여 승률에 반영

 6-2. 전적 모달

 - 게임 시간
 - 참여 플레이어 목록 + 각 플레이어의 순위(placement)

 ---
 Phase 7: 마무리

 - 연결 끊김 처리: 활성 게임 중 disconnect → 타임아웃 후 abandoned 처리 + auto-fold
 - lint + unit test 전체 통과 확인
 - ai-review 스킬로 코드 리뷰
 - 리뷰 결과 조치 후 review/**/RESOLUTION.md 작성

 ---
 Implementation Order (구현 순서)

 ▎ 각 단계마다 TDD: 테스트 먼저 → 구현 → lint/test 통과 확인

 1. Spec 문서 작성 (Phase 1)
 2. Backend 기반 설정 — DB, Player 모듈, 쿠키 인증 (Phase 2)
 3. Poker Engine — Deck, HandEvaluator, BettingRound, PotCalculator (Phase 3-1)
 4. Poker Engine 변형 — Texas Hold'em → 5 Card Draw → 7 Card Stud (Phase 3-3)
 5. Poker Engine 모드 — Tournament, Cash Game (Phase 3-4)
 6. Room 모듈 — REST + WebSocket (Phase 4-1)
 7. Game 모듈 — 엔진 통합 + WebSocket (Phase 4-2)
 8. Frontend 기반 — 프로바이더, 소켓, 상태관리 (Phase 5-1~3)
 9. 타이틀 페이지 (Phase 5-4)
 10. 게임 화면 (Phase 5-4)
 11. 명예의 전당 (Phase 6)
 12. 연결 끊김/마무리 (Phase 7)

 ---
 Verification (검증)

 1. Unit Tests: 각 모듈별 Jest 테스트 (특히 포커 엔진 — 핸드 평가, 베팅 로직, 사이드 팟)
 2. Integration Tests: WebSocket 이벤트 흐름 (room join → ready → game start → actions → showdown)
 3. E2E Manual Test: 브라우저 2개로 실제 게임 플레이
 4. Lint: backend npm run lint, frontend npm run lint
 5. Build: backend npm run build, frontend npm run build
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```

# Turn 2
turn 1에서 AI review 누락 확인

```text
ai-review를 실행하고, 조치사항을 처리해 주세요.
```

# Turn 3
frontend에서 TDD 원칙 위배 확인 (테스트 코드를 작성하지 않고, 리뷰 의견에도 보류 처리)

```text
코드 리뷰 결과를 다시 확인하고, 보류했던 테스트 코드를 모두 작성해 주세요.
```

# Turn 4
"서버에 연결 중..." 메세지만 표시되며 연결되지 않음

```text
실제 실행 시 "서버에 연결 중..." 메세지만 표시되고, 진행이 되지 않습니다.
원인을 상세히 파악하여 정상적으로 게임을 진행할 수 있도록 처리해 주세요.
```

# Turn 5
turn 1에서 AI review 누락 확인

```text
ai-review를 실행하고, 조치사항을 처리해 주세요.
```
