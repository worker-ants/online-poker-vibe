# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 테스트 프레임워크 오류, 타입 불일치로 인한 런타임 버그, 성능 병목, 미구현 요구사항이 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/테스트 | `RoomState.settings` 필수 필드가 테스트 fixture에서 누락 → TypeScript 컴파일 오류 | `useGameStore.spec.ts:36,49,63` | fixture에 `settings: { startingChips: 1000, smallBlind: 10, bigBlind: 20 }` 추가 |
| 2 | 요구사항 | `CreateRoomModal`에서 `ante`/`blindSchedule` 설정 불가 → Seven Card Stud·Tournament 모드 핵심 기능 동작 안 함 | `CreateRoomModal.tsx`, `handleSubmit` | `onCreate` 타입을 `settings: RoomSettings`로 확장, variant별 추가 입력 UI 구현 |
| 3 | 사이드이펙트 | `Modal.tsx`에서 `document.body.style.overflow` 전역 수정 → 중첩 모달 닫힐 때 열린 모달의 스크롤 잠금 해제됨 | `Modal.tsx useEffect:10-17` | 기존 값 저장 후 복원: `const prev = document.body.style.overflow; ... return () => { body.style.overflow = prev; }` |
| 4 | 아키텍처 | 프론트엔드·백엔드 도메인 타입 독립 중복 정의, 공유 패키지 없음 → `GamePhase` 등 이미 불일치 발생 | `frontend/src/lib/types.ts` ↔ `backend/src/common/types/` | `packages/shared` 공유 패키지 생성, 타입/이벤트 상수 통합 |
| 5 | 성능 | `BettingRound.cloneState()`가 `JSON.parse(JSON.stringify())` 방식으로 매 베팅 액션마다 전체 GameState 직렬화 (roundHistory 누적으로 비용 선형 증가) | `betting-round.ts:cloneState()` | `structuredClone(state)` 사용 (Node.js 17+, 약 2~3배 빠름) |
| 6 | 성능 | `Deck.shuffle()`이 `crypto.randomInt()`를 51회 호출 → OS syscall 51회/셔플 | `deck.ts:shuffle()` | `crypto.getRandomValues(new Uint32Array(52))`로 1회 호출 후 Fisher-Yates 적용 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | React 안티패턴 | 렌더 함수 내 `setPrevMinRaise`·`setRaiseAmount` 직접 호출 → 이중 렌더 유발 (5개 이상 리뷰어 지적) | `BettingControls.tsx:12-17` | `useEffect(() => { setRaiseAmount(actionRequired.minRaise); }, [actionRequired.minRaise])` 로 교체, `prevMinRaise` 상태 제거 |
| 2 | API 계약 | 프론트엔드 `GamePhase`에 `'pre-deal'` 존재하나 백엔드에 없음 (dead code + 타입 불일치) | `frontend/types.ts` vs `backend/game.types.ts` | 프론트엔드에서 `'pre-deal'` 제거 또는 백엔드에 추가 |
| 3 | API 계약 | `ActionRequired.isDraw?: boolean`이 프론트엔드 타입에 누락 → Five Card Draw 드로우 단계 UI 미동작 | `frontend/types.ts:ActionRequired` | `isDraw?: boolean` 추가, `BettingControls`에 드로우 UI 분기 처리 |
| 4 | API 계약 | `Card.rank`가 프론트엔드에서 `string` 타입 → 타입 안전성 없음 | `frontend/types.ts:8` | `rank: '2'\|'3'\|...\|'A'` 로 강타입화 |
| 5 | API 계약 | `GameHistoryEntry.variant`/`mode`가 `string` 타입 → `as PokerVariant` 강제 캐스팅 필요 | `frontend/types.ts`, `PlayerHistoryModal.tsx:40` | `variant: PokerVariant`, `mode: GameMode` 으로 변경 |
| 6 | 요구사항 | `PotDisplay`에서 `sidePots.length > 1` 조건으로 사이드팟 1개일 때 미표시 | `PotDisplay.tsx:14` | 조건을 `sidePots && sidePots.length >= 1` 로 변경 |
| 7 | 요구사항 | `CommunityCards`가 카드 0장일 때 `null` 반환 → 프리플롭에서 테이블 레이아웃 불안정 | `CommunityCards.tsx:12` | 0장일 때도 5개 빈 placeholder 슬롯 렌더링 |
| 8 | 요구사항 | `ActionRequired.timeLimit`이 UI에 미표시 → 플레이어가 남은 시간 확인 불가, 타임아웃 강제 폴드 시 UX 심각 | `BettingControls.tsx` | 카운트다운 타이머 컴포넌트 추가 |
| 9 | 보안 | `action.amount`에 `NaN`/`Infinity` 검증 없음 → `player.chips -= NaN` 게임 상태 오염 | `betting-round.ts:raise case` | `if (!Number.isFinite(raiseAmount) \|\| raiseAmount <= 0) throw new Error(...)` 추가 |
| 10 | 보안 | `NEXT_PUBLIC_BACKEND_URL` 미설정 시 `http://localhost:3000` 폴백 → 프로덕션 평문 전송 위험 | `frontend/lib/constants.ts:BACKEND_URL` | CI/CD에서 환경변수 미설정 시 빌드 실패 처리, 또는 기본값 제거 |
| 11 | 보안 | `player_uuid` 쿠키에 `HttpOnly`·`Secure`·`SameSite` 속성 적용 여부 미확인 | `backend/src/player/` (쿠키 설정 코드) | 쿠키 설정 시 `httpOnly: true`, `secure: true`(프로덕션), `sameSite: 'strict'` 적용 확인 |
| 12 | 보안 | HTTP 상태 변경 엔드포인트에 CSRF 토큰 검증 없음 | `backend/src/player/`, `hall-of-fame/` | NestJS `csurf` 미들웨어 또는 `SameSite=Strict` 쿠키 속성 적용 |
| 13 | 비동기 | `SocketProvider.init()`에서 `newSocket.connect()` 후 언마운트 시 `setIsConnected` 호출 가능 | `SocketProvider.tsx:init()` | `onConnect`/`onDisconnect` 핸들러 내부에서도 `if (!cancelled)` 체크 추가 |
| 14 | 비동기 | `ToastProvider`에서 `setTimeout` 반환 ID 저장 안 함 → 언마운트 후 4초 타이머 계속 실행 | `ToastProvider.tsx:addToast` | `useRef<Set<ReturnType<typeof setTimeout>>>` 로 타이머 추적, cleanup에서 `clearTimeout` 호출 |
| 15 | 비동기 | 모듈 레벨 소켓 싱글톤과 React Strict Mode 이중 실행 충돌 → 첫 번째 소켓 핸들러 중복 가능 | `frontend/lib/socket.ts` | `useRef`로 소켓 라이프사이클을 컴포넌트 내에서 관리하거나 cleanup 순서 보장 |
| 16 | 비동기 | `IdentityProvider.setNickname()`에서 소켓 단절 시 Promise가 영구 미해결 → `isSubmitting` 무한 `true` | `IdentityProvider.tsx:36-53` | 타임아웃 추가 또는 `socket.once('disconnect', reject)` 처리 |
| 17 | 아키텍처 | `SocketProvider`에 HTTP 세션 초기화와 WebSocket 생명주기 혼재 | `SocketProvider.tsx:30-50` | `PlayerSessionInitializer` 등 별도 훅으로 쿠키 초기화 관심사 분리 |
| 18 | 아키텍처 | `AiPlayerService`가 `HandEvaluator`를 직접 인스턴스화, 핸드 강도 평가 로직 포함 → DI 원칙 위반 | `ai-player.service.ts:93-145` | `HandEvaluator` DI 주입, 핸드 강도 로직을 별도 서비스로 분리 |
| 19 | 아키텍처 | `VARIANT_LABELS`·`MODE_LABELS` 런타임 상수가 타입 정의 파일에 혼재 | `frontend/lib/types.ts:103-113` | `lib/constants.ts` 또는 `lib/labels.ts` 로 분리 |
| 20 | 아키텍처 | `CommunityCards`에서 `5 - cards.length` 하드코딩 → Seven Card Stud·Five Card Draw에서 잘못된 플레이스홀더 | `CommunityCards.tsx:15` | `maxCards` prop 추가하여 외부에서 제어 |
| 21 | 데이터베이스 | `synchronize: process.env.NODE_ENV !== 'production'` → 스테이징에서 의도치 않은 스키마 변경·데이터 손실 위험 | `database.module.ts:10` | `synchronize: false` 고정, TypeORM Migration 명시적 사용 |
| 22 | 테스트 | `BettingControls.spec.tsx`에 raise 액션 콜백 검증 없음 (raise 금액 전달, all-in 버튼 테스트 부재) | `BettingControls.spec.tsx` | `onAction('raise', amount)` 호출 검증 테스트, all-in 버튼 렌더링 테스트 추가 |
| 23 | 테스트 | `useGameStore.spec.ts`에 `setShowdown`·`setGameEnd` 테스트 없음, `reset()` 후 null 검증 없음 | `useGameStore.spec.ts` | 두 setter 기본 테스트 및 reset 후 null 검증 추가 |
| 24 | 테스트 | `PokerTable`·`NicknameInput`·`CreateRoomModal`·`Modal`·`PlayerSeat` 등 핵심 컴포넌트 테스트 전무 | 해당 컴포넌트 파일들 | 좌석 재정렬, 비동기 제출, overflow 사이드이펙트 등 우선 테스트 작성 |
| 25 | 테스트 | `BettingRound.resetForNewRound`·`isOnlyOnePlayerRemaining`·`findNextActivePlayer` 테스트 없음 | `betting-round.spec.ts` | 세 메서드 단위 테스트 추가, 전원 fold/all-in 엣지케이스 포함 |
| 26 | 문서화 | `HAND_CATEGORY_RANKS`(game.types.ts)와 `scoreMap`(ai-player.service.ts)이 동일 정보 두 곳 정의 → 동기화 위험 | `game.types.ts`, `ai-player.service.ts:167-178` | `scoreMap` 제거, `categoryRank` 값 정규화 수식으로 통일 또는 단일 출처로 통합 |
| 27 | 요구사항 | `HelpModal`에서 `variant`가 없을 때 규칙 계산은 하나 `{variant && ...}` 조건으로 미표시 → 데드코드 | `HelpModal.tsx:47` | variant 없을 때 `'texas-holdem'` 기본값으로 규칙 표시 또는 변수 계산 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `PlayerPublicState.isAI` 백엔드 required, 프론트엔드 optional | `frontend/types.ts` | `isAI: boolean` 으로 통일 |
| 2 | API 계약 | `GameEndPlayerResult.placement` 백엔드 required, 프론트엔드 optional | `frontend/types.ts` | `placement: number` 로 변경 |
| 3 | API 계약 | 방 목록·랭킹 API에 페이지네이션 없음 | `useRoomList.ts`, `RankingsTable.tsx` | 단기적으로 서버에서 최대 N개 제한 |
| 4 | 성능 | `PokerTable`에서 플레이어 배열 재정렬이 `useMemo` 없이 매 렌더 실행 | `PokerTable.tsx:24-30` | `useMemo([gameState.players, myUuid])` 로 감싸기 |
| 5 | 성능 | `RankingsTable`·`PlayerHistoryModal`에서 `new Date().toLocaleString()` 매 렌더 실행 | 해당 컴포넌트 | `useMemo` 캐싱 또는 `React.memo` 래핑 |
| 6 | 성능 | `roundHistory` 무제한 누적으로 `cloneState` 비용 증가 | `betting-round.ts:applyAction()` | 라운드 완료 시 히스토리 별도 스토리지 이동, GameState에는 현재 라운드만 유지 |
| 7 | 보안 | WebSocket 게임 액션에 레이트 리미팅 없음 | `backend/src/game/` | `@nestjs/throttler` 또는 WebSocket 미들웨어에서 클라이언트별 빈도 제한 |
| 8 | 보안 | AI 플레이어 판별이 UUID 접두사(`ai-player-`)에만 의존 | `backend/src/ai/ai-names.ts` | DB에 `isAI: boolean` 플래그 추가 |
| 9 | 아키텍처 | `GameLayout.tsx`에 불필요한 `'use client'` → Server Component로 전환 가능 | `GameLayout.tsx:1` | `'use client'` 제거 |
| 10 | 아키텍처 | `PotDisplay`에서 `SidePot` 인터페이스 재사용 않고 인라인 타입 정의 | `PotDisplay.tsx:4` | `import type { SidePot }` 사용 |
| 11 | 데이터베이스 | `NicknameRequiredGuard`가 보호된 모든 요청에서 DB 조회 | `nickname-required.guard.ts:17` | `player_uuid` 컬럼에 `@Index()` 데코레이터 적용 |
| 12 | 의존성 | 백엔드 ESM 패턴(`.js` import)과 `__dirname`(CommonJS 전용) 혼용 | `database.module.ts` | `import.meta.url` + `fileURLToPath` 로 대체하거나 `tsconfig` module 설정 확인 |
| 13 | 테스트 | `Card.spec.tsx`의 `expect(container.firstChild).toBeDefined()` 무의미한 단언 | `Card.spec.tsx` | 제거하거나 CSS 클래스 검증으로 대체 |
| 14 | 테스트 | 프론트엔드(Vitest)·백엔드(Jest) 프레임워크 혼용 — 문서화 필요 | 전체 테스트 구조 | CLAUDE.md 또는 README에 "프론트엔드: Vitest, 백엔드: Jest" 명시 |
| 15 | 사이드이펙트 | `PlayerSeat`·`CommunityCards`에서 배열 인덱스를 `key`로 사용 → 카드 추가/제거 시 애니메이션 오작동 | `PlayerSeat.tsx:41-52`, `CommunityCards.tsx` | `key={\`${card.suit}-${card.rank}\`}` 등 고유 식별자 사용 |
| 16 | 유지보수 | `ai-player.service.ts:decideAction`의 `0.8`·`0.6` 등 핸드 강도 임계값 매직 넘버 | `ai-player.service.ts:52-100` | `HAND_STRENGTH`, `BLUFF_RATE` 상수로 추출 |
| 17 | 문서화 | `SocketProvider.tsx`의 `/player/me` 선호출 이유 미주석 (쿠키 기반 소켓 인증 플로우) | `SocketProvider.tsx:25-29` | 쿠키 초기화 플로우 및 실패 시 동작 이유 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | CreateRoomModal ante/blindSchedule 미구현, RoomState 타입 오류, 타이머 미표시 |
| architecture | HIGH | 프론트-백엔드 타입 중복, AiPlayerService DI 위반, BettingControls 안티패턴 |
| testing | HIGH | ai-player.service.spec 프레임워크 혼용 의심, RoomState fixture 타입 오류, 핵심 컴포넌트 테스트 부재 |
| performance | HIGH | JSON 직렬화 딥클론, crypto syscall 51회, PokerTable useMemo 누락 |
| security | MEDIUM | NaN/Infinity 미검증, HTTP 폴백, CSRF·쿠키 보안 속성 미확인 |
| api_contract | MEDIUM | GamePhase/isDraw/Card.rank 타입 불일치, GameHistoryEntry unsafe 캐스팅 |
| side_effect | MEDIUM | Modal overflow 전역 충돌, ToastProvider 타이머 누수, SocketProvider 경쟁 조건 |
| concurrency | LOW | SocketProvider/ToastProvider 비동기 안전성, BettingControls 이중 렌더 |
| documentation | LOW | scoreMap 매직 넘버, SocketProvider 쿠키 플로우, PotDisplay 조건 미주석 |
| database | LOW | synchronize 옵션 위험, NicknameRequiredGuard 매 요청 DB 조회 |
| dependency | LOW | ESM/__dirname 불일치, PlayerHistoryModal 중복 import |
| maintainability | LOW | AiPlayerService 매직 넘버, scoreMap 중복, structuredClone 전환 |
| scope | LOW | 변경 미포함 파일 다수 포함 — 실제 변경 파일 확인 필요 |

---

## 발견 없는 에이전트
없음 (모든 에이전트가 발견사항 보고)

---

## 권장 조치사항

1. **[즉시]** `useGameStore.spec.ts` fixture에 `settings` 필드 추가 → 컴파일 오류 해소
2. **[즉시]** `betting-round.ts`의 `action.amount` NaN/Infinity 검증 추가 → 게임 상태 오염 방지
3. **[즉시]** `BettingControls.tsx` 렌더 중 setState → `useEffect`로 교체
4. **[즉시]** `Modal.tsx` `document.body.style.overflow` 이전 값 저장·복원 방식으로 수정
5. **[단기]** `BettingRound.cloneState()` → `structuredClone()` 교체 + roundHistory 분리
6. **[단기]** `CreateRoomModal`에 `ante`·`blindSchedule` 설정 UI 추가 (Seven Card Stud·Tournament 기능 완성)
7. **[단기]** 프론트엔드 타입 정확화: `GamePhase` `pre-deal` 제거, `isDraw` 추가, `Card.rank` 강타입화
8. **[단기]** `ToastProvider` setTimeout 정리, `SocketProvider` cancelled 플래그 핸들러 내부 체크
9. **[단기]** `PotDisplay` 사이드팟 조건 `>= 1`, `CommunityCards` 빈 플레이스홀더 렌더링
10. **[단기]** 프로덕션 보안: 쿠키 `HttpOnly`·`Secure`·`SameSite` 속성, `NEXT_PUBLIC_BACKEND_URL` 필수화
11. **[중기]** `packages/shared` 공유 타입 패키지 구성 (타입 드리프트 구조적 방지)
12. **[중기]** 핵심 컴포넌트(`PokerTable`, `NicknameInput`, `Modal`) 테스트 작성
13. **[중기]** `database.module.ts` `synchronize: false` 고정, TypeORM Migration 도입
14. **[중기]** `Deck.shuffle()` 단일 `crypto.getRandomValues()` 호출로 개선