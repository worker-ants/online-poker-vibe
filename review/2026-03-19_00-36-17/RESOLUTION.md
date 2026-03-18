# Code Review Resolution (Batch 1)

## Critical 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|---------|----------|------|
| 1 | `useGameStore.spec.ts` fixture에 `settings` 누락 | 모든 RoomState fixture에 `settings: { startingChips: 1000, smallBlind: 10, bigBlind: 20 }` 추가. `setShowdown`, `setGameEnd` 테스트 추가 | 완료 |
| 2 | `CreateRoomModal` ante/blindSchedule 미구현 | 신규 기능 구현 범위 - 별도 태스크로 분리 필요 | 보류 |
| 3 | `Modal.tsx` overflow 전역 수정 | 이전 값 저장 후 복원 패턴 적용: `const prev = document.body.style.overflow` | 완료 |
| 4 | 프론트/백엔드 타입 독립 중복 | 프론트엔드 타입을 백엔드와 일치하도록 정확화 (Card.rank 강타입, GamePhase pre-deal 제거, isAI/placement required 등). 공유 패키지는 중기 과제 | 부분 완료 |
| 5 | `BettingRound.cloneState()` JSON.parse 방식 | `structuredClone(state)` 으로 교체. 세 엔진 파일도 동일 적용 | 완료 |
| 6 | `Deck.shuffle()` crypto 51회 호출 | 이미 `crypto.randomInt()` 사용 중으로 확인. 개선 여지 있으나 기능적 문제 없음 | 확인 완료 |

## Warning 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|---------|----------|------|
| 1 | BettingControls 렌더 중 setState | useState 기반 이전 값 비교 패턴으로 교체 (useEffect/useRef 미사용, lint 통과) | 완료 |
| 2 | GamePhase `pre-deal` 불일치 | 프론트엔드에서 `pre-deal` 제거 | 완료 |
| 3 | `ActionRequired.isDraw` 누락 | 프론트엔드 타입에 `isDraw?: boolean` 추가 | 완료 |
| 4 | `Card.rank` string 타입 | 리터럴 유니온 타입으로 강타입화 | 완료 |
| 5 | `GameHistoryEntry` variant/mode string | `PokerVariant`, `GameMode` 타입으로 변경, 불필요한 `as` 캐스팅 제거 | 완료 |
| 6 | `PotDisplay` 사이드팟 조건 | `sidePots.length > 1` → `sidePots.length >= 1` 수정 | 완료 |
| 7 | `CommunityCards` 0장 시 null | 빈 placeholder 5개 렌더링, `maxCards` prop 추가, 고유 key 사용 | 완료 |
| 8 | `ActionRequired.timeLimit` UI 미표시 | 카운트다운 타이머 UI는 신규 기능 - 별도 태스크 | 보류 |
| 9 | `action.amount` NaN/Infinity 미검증 | `Number.isFinite()` 검증 추가 | 완료 |
| 10 | `NEXT_PUBLIC_BACKEND_URL` 폴백 | 프로덕션 배포 시 CI/CD 설정 필요 - 현재 개발 환경용으로 유지 | 확인 완료 |
| 11 | 쿠키 보안 속성 | UUID 형식 검증 추가 (player.controller, room.gateway). HttpOnly/Secure는 프로덕션 배포 시 적용 | 부분 완료 |
| 12 | CSRF 보호 | SameSite 쿠키 정책 + UUID 검증으로 기본 보호. 전용 CSRF 미들웨어는 중기 과제 | 부분 완료 |
| 13 | SocketProvider 비동기 race condition | `onConnect`/`onDisconnect` 핸들러에 `cancelled` 체크 추가 | 완료 |
| 14 | ToastProvider setTimeout 누수 | `useRef<Set<>>` 로 타이머 추적, cleanup 시 전부 clear | 완료 |
| 15 | 모듈 레벨 소켓 싱글톤 | React Strict Mode 중복 방지 구조 확인 필요 - 중기 과제 | 보류 |
| 16 | IdentityProvider Promise 미해결 | 10초 타임아웃 + disconnect 이벤트 리스너로 reject 처리 | 완료 |
| 17 | SocketProvider 관심사 혼재 | 아키텍처 리팩토링 범위 - 별도 태스크 | 보류 |
| 18 | AiPlayerService DI 위반 | 중기 리팩토링 범위 | 보류 |
| 19 | VARIANT_LABELS/MODE_LABELS 위치 | `lib/constants.ts`로 이동, import 경로 업데이트 | 완료 |
| 20 | CommunityCards 하드코딩 5 | `maxCards` prop 추가 (기본값 5) | 완료 |
| 21 | DB synchronize 옵션 | 개발 환경에서는 테이블 자동 생성이 필요하므로 `synchronize: process.env.NODE_ENV !== 'production'` 유지. 프로덕션 배포 시 Migration 도입 필요 | 완료 |
| 22-25 | 테스트 커버리지 | useGameStore.spec에 showdown/gameEnd 테스트 추가. 전체 커버리지 확대는 별도 태스크 | 부분 완료 |
| 26 | scoreMap 중복 | `HAND_CATEGORY_RANKS` import로 통합 | 완료 |
| 27 | HelpModal 데드코드 | variant 없을 때 `'texas-holdem'` 기본값 적용, 조건을 `rules` 존재 여부로 변경 | 완료 |
