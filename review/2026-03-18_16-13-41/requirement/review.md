### 발견사항

**[CRITICAL] `pot-calculator.ts`의 사이드팟 계산 로직 버그**
- 위치: `pot-calculator.ts`, `calculatePots()` 내 `partialContributors` 변수
- 상세: `partialContributors`가 선언되지만 실제 계산에 전혀 사용되지 않음. 폴드한 플레이어의 베팅액이 팟에 잘못 귀속될 수 있음
- 제안: 부분 기여자의 칩을 별도로 처리하거나 해당 변수를 제거하고 로직을 재검토

**[CRITICAL] `seven-card-stud.engine.ts` 앤티 이후 플레이어 `currentBet` 초기화 문제**
- 위치: `startHand()`, 앤티 수집 후 `p.currentBet = anteAmount` 설정 직후 재초기화
- 상세: 앤티를 수집하여 `currentBet`에 설정한 뒤, 몇 줄 후 `p.currentBet = 0`으로 재초기화함. 앤티가 팟에는 추가되지만 `currentBet`이 0으로 리셋되어 베팅 라운드 계산 시 불일치 발생
- 제안: 앤티 컬렉션과 베팅 라운드 초기화를 명확히 분리하거나 앤티를 `currentBet`에서 제외하여 관리

**[CRITICAL] `game.service.ts` 멀티-핸드 게임에서 `startNextHand()` 미호출**
- 위치: `handleAction()` 내 `gameOver` 처리 분기
- 상세: 핸드가 종료되고 게임이 끝나지 않은 경우, 클라이언트가 별도 이벤트를 받아 다음 핸드를 트리거해야 하지만 `startNextHand()`를 자동 호출하는 경로가 없음. Gateway에서 이를 처리하는지 diff에서 확인 불가 (파일 누락)
- 제안: `handleAction()` 반환값에 `nextHandReady: boolean` 플래그 추가 또는 Gateway에서 일정 딜레이 후 자동 호출 확인

**[WARNING] `betting-round.ts`의 `findNextActivePlayer()` 무한 루프 가능성**
- 위치: `findNextActivePlayer()`, 반환값 `fromIndex`
- 상세: 모든 플레이어가 폴드/올인인 경우 `fromIndex`를 반환하는데, 이 인덱스의 플레이어가 이미 폴드/올인 상태일 수 있음. 이후 로직에서 해당 플레이어에게 액션을 요청하면 에러 발생
- 제안: -1 또는 null 반환 후 호출부에서 처리

**[WARNING] `texas-holdem.engine.ts` 헤즈업 블라인드 구조 미검증**
- 위치: `startHand()` 내 딜러/블라인드 인덱스 설정
- 상세: 테스트에서 헤즈업 시 `smallBlindIndex === dealerIndex` 확인만 함. 헤즈업 포커에서는 딜러=SB이고 BB가 먼저 프리플랍 행동해야 하는 규칙이 올바르게 구현되었는지 불명확
- 제안: 헤즈업 프리플랍 액션 순서(`currentPlayerIndex`)가 BB 플레이어를 가리키는지 테스트 추가

**[WARNING] `room.controller.ts` 쿠키 접근 방식 불일치**
- 위치: `createRoom()`, `(req as any).cookies?.player_uuid`
- 상세: 타입 캐스팅 `(req as any)` 사용. `PlayerController`에서는 `@Req() req: Request`로 올바르게 타입 처리하는데 일관성 없음. `NicknameRequiredGuard`가 있음에도 직접 쿠키 검사
- 제안: `@PlayerUuid()` 데코레이터 또는 `NicknameRequiredGuard` 사용으로 통일

**[WARNING] `hall-of-fame.service.ts` N+1 쿼리 문제**
- 위치: `getPlayerHistory()`, for 루프 내 `participantRepository.find()`
- 상세: 게임 히스토리 조회 시 각 게임마다 DB 쿼리를 추가 실행함. 게임 수가 많을 경우 성능 저하
- 제안: JOIN 쿼리 또는 `gameId IN (...)` 배치 조회로 변경

**[WARNING] `database.module.ts` 프로덕션에서 `synchronize: true` 위험**
- 위치: `TypeOrmModule.forRoot()` 설정
- 상세: `synchronize: true`는 프로덕션 환경에서 데이터 손실 위험이 있음
- 제안: `process.env.NODE_ENV !== 'production'` 조건으로 환경별 분기

**[WARNING] `player.service.ts` UUID 검증 없음**
- 위치: `findOrCreate()`, `findByUuid()` 파라미터
- 상세: 외부에서 넘어오는 UUID 형식 검증이 없음. 악의적인 쿠키 변조 시 비정상 값이 DB 쿼리에 그대로 사용됨
- 제안: UUID v4 형식 정규식 검증 추가

**[WARNING] `game.service.ts` `finishGame()` 무승부 처리 누락**
- 위치: `finishGame()`, 플레이어 결과 판정 로직
- 상세: `i === 0`이면 무조건 `win`으로 처리하나, 칩이 동일한 플레이어가 여럿인 경우 (타이) 1위가 여러 명일 수 있음. `draw` 결과가 `GameResult` 타입에 있으나 실제로 사용되지 않음
- 제안: 동일 칩 보유 시 `draw` 처리 로직 추가

**[INFO] `five-card-draw.engine.ts` diff 미포함**
- 상세: 파일 47(room.gateway.ts)와 파일 27(five-card-draw.engine.ts)의 diff가 프롬프트 한계로 누락됨. 드로우 단계에서 카드 교환 검증(최대 교환 수, 덱 부족 처리)이 올바른지 확인 필요

**[INFO] `game/page.tsx` 게임 중 페이지 새로고침 시 상태 복구 미구현**
- 위치: `useEffect` 내 `ROOM_JOIN` 이후 처리
- 상세: 방 조인 콜백에서 `response.room`을 받아 설정하지만 진행 중인 게임 상태(`gameState`, `holeCards`)를 복구하는 로직이 없음. 새로고침 시 게임 테이블이 빈 상태로 표시됨
- 제안: 조인 응답에 현재 게임 공개 상태 포함 또는 별도 `GAME_STATE` 재요청

---

### 요약

전반적으로 텍사스 홀덤 중심의 핵심 게임 로직(덱, 핸드 평가, 베팅 라운드)은 TDD 기반으로 잘 구현되어 있으며 주요 엣지 케이스(휠 스트레이트, 올인, 사이드팟 구조)도 설계에 반영되어 있습니다. 그러나 **팟 계산기의 사이드팟 로직 버그**, **세븐카드 스터드 앤티 초기화 충돌**, **멀티핸드 게임 흐름 제어 불명확성** 등 게임 진행에 직접 영향을 미치는 CRITICAL 이슈 3건이 존재하며, 프로덕션 환경에서의 DB 동기화, N+1 쿼리, UUID 검증 누락 등 운영 안정성 관련 WARNING도 다수 발견됩니다. 프론트엔드 측에서는 페이지 새로고침 시 게임 상태 복구가 구현되지 않아 사용자 경험에 영향을 줄 수 있습니다.

### 위험도

**HIGH**