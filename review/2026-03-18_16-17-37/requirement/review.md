### 발견사항

**[WARNING]** `handleCreate`의 `data` 파라미터 타입이 `any`
- 위치: `frontend/app/page.tsx:52`
- 상세: `onCreate: (data: any)` — 타입 안전성 없이 소켓으로 전송됨
- 제안: `CreateRoomModal`의 `onCreate` 콜백 타입과 동일하게 명시

**[WARNING]** `IdentityProvider`가 소켓 재연결 후 `identity:confirmed`를 재수신하지 못할 수 있음
- 위치: `frontend/src/providers/IdentityProvider.tsx:30-39`
- 상세: `socket.on(IDENTITY_CONFIRMED, ...)` 등록 후 소켓이 재연결되면 서버에서 `identity:confirmed`를 재전송하는지 보장되지 않음. 재연결 후 `nickname`이 `null`로 남아있을 수 있음
- 제안: `connect` 이벤트 핸들러에서 `identity:confirmed` 수신 로직 보완, 또는 `isLoading`을 재연결 시 `true`로 리셋

**[WARNING]** `BettingControls`에서 `raiseAmount` 초기값이 변경되지 않음
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx:12`
- 상세: `useState(actionRequired.minRaise)`는 최초 렌더 시에만 초기화. `actionRequired`가 변경되어도 `raiseAmount`는 이전 값을 유지함. 새 베팅 라운드에서 잘못된 금액이 표시될 수 있음
- 제안: `useEffect`로 `actionRequired.minRaise` 변경 시 `raiseAmount` 동기화

**[WARNING]** `CommunityCards`에서 `faceUp=false` 카드가 없는 경우 5개 미만 시 빈 슬롯이 항상 표시됨
- 위치: `frontend/src/components/game/table/CommunityCards.tsx:19-24`
- 상세: `cards.length === 0`이면 `null` 반환하지만, 1~4장이면 빈 슬롯이 표시됨. 비즈니스적으로 Pre-flop 단계(0장)에서는 숨기고, Flop(3장) 이후에는 남은 슬롯 표시가 맞는지 검토 필요
- 상세: 스펙(`game:state`)에서 `communityCards.length > 0` 일 때만 컴포넌트 렌더링을 조건으로 달고 있음 (`PokerTable.tsx:47`) — 일관성은 있으나 의도 명시 필요

**[WARNING]** `PlayerSeat`에서 `isMe=false`인 경우 `cards`와 `cardCount`가 동시에 렌더링될 수 있음
- 위치: `frontend/src/components/game/table/PlayerSeat.tsx:43-57`
- 상세: `isMe=false`일 때 `cards`는 `undefined`, 뒤집힌 카드 `cardCount`장 + `visibleCards` 모두 렌더. Stud 게임에서 `visibleCards`와 `cardCount`(비공개 수)가 겹쳐 렌더링되는 로직은 맞지만, `cardCount`와 `visibleCards.length`의 합이 실제 패 수를 초과하는 경우 처리가 없음

**[INFO]** `useRoomList`가 소켓 재연결 후 방 목록을 재요청하지 않음
- 위치: `frontend/src/hooks/useRoomList.ts:16-37`
- 상세: 의존성 배열이 `[socket, setRoomList]`이므로 재연결 시 새 소켓 인스턴스가 설정되면 재요청됨. 하지만 `SocketProvider`에서 소켓 인스턴스 자체를 `disconnectSocket()` 후 재생성하지 않으면 재요청이 안 됨
- 제안: `isConnected` 변경 시에도 목록 재요청 추가

**[INFO]** `HallOfFamePage`에서 `handlePlayerClick` 실패 시 UI 피드백 없음
- 위치: `frontend/app/hall-of-fame/page.tsx:50-60`
- 상세: `catch` 블록이 `// ignore`로 처리됨. 네트워크 오류 시 사용자에게 아무 피드백 없음
- 제안: Toast 또는 에러 상태 표시

**[INFO]** `PokerTable`에서 7명 이상 플레이어 처리 누락
- 위치: `frontend/src/components/game/table/PokerTable.tsx:17-22, 56`
- 상세: `SEAT_POSITIONS`가 6개 정의. 7명째는 `SEAT_POSITIONS[6] ?? SEAT_POSITIONS[0]`으로 fallback. 스펙상 최대 6명이지만 방어 코드가 없어 2명이 같은 위치에 겹칠 수 있음
- 제안: 6명 초과 시 에러 로깅 또는 단순 방어 처리

**[INFO]** `next.config.ts` rewrite가 프로덕션 환경에서 localhost를 가리킴
- 위치: `frontend/next.config.ts:6`
- 상세: `destination: 'http://localhost:3000/:path*'` — 환경 변수로 분리되지 않아 프로덕션 배포 시 문제 발생 가능
- 제안: `process.env.NEXT_PUBLIC_BACKEND_URL` 또는 별도 서버사이드 환경변수 사용

---

### 요약

프론트엔드 전반적으로 스펙(`spec/09-frontend-ui.md`, `spec/07-websocket-events.md`)의 핵심 구조(로비, 게임 화면, 명예의 전당, Provider 체계, Zustand 스토어)는 충실히 구현되어 있습니다. 그러나 소켓 재연결 후 identity/roomList 복구 로직의 미비, `BettingControls`의 `raiseAmount` 상태 동기화 누락, 오류 시 사용자 피드백 부재 등 런타임에서 드러날 엣지 케이스들이 존재합니다. `handleCreate`의 `any` 타입과 프로덕션 환경의 `next.config.ts` 하드코딩도 개선이 필요합니다. 전체적으로 기능 완전성 측면에서 80% 수준이며, 재연결·오류 시나리오 처리가 보완되면 요구사항을 충분히 만족할 수 있습니다.

### 위험도
**MEDIUM**