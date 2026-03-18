# 코드 리뷰 조치 내용

## 조치 대상
- 커밋: `b0da77a` (turn 4: 서버와 연결이 되지 않는 이슈 수정)
- 리뷰 일시: 2026-03-18

## 조치 완료 항목

### Critical #1: fetch 실패 케이스 및 race condition 시나리오 테스트 없음
- **조치**: `SocketProvider.spec.tsx` 테스트 파일 생성 (8개 테스트 케이스)
  - fetch 성공 시 정상 소켓 연결 확인
  - 이벤트 리스너 등록 순서 검증 (connect 전 리스너 등록)
  - connect/disconnect 이벤트에 따른 isConnected 상태 전환
  - fetch 실패 시에도 소켓 연결 시도 확인
  - unmount 시 이벤트 리스너 제거 확인
  - unmount 후 fetch 완료 시 소켓 미연결 확인 (race condition)
  - 초기 상태 검증

### WARNING #1: fetch 실패 시 uncaught rejection으로 소켓 연결 전체 차단
- **조치**: `try/catch`로 fetch를 감싸고, 실패 시에도 소켓 연결을 시도하도록 수정
  - 쿠키가 이미 존재하는 경우 fetch 없이도 소켓 인증 가능

### WARNING #2: cancelled 플래그와 disconnectSocket 간 race condition
- **조치**: `socketRef`로 소켓 참조 보관, `s.connect()` 이후 `cancelled` 재확인 추가
  - cleanup에서 `socketRef.current`를 통해 직접 리스너 제거

### WARNING #3: 이벤트 리스너 누수
- **조치**: cleanup 시 `socket.off('connect', onConnect)`, `socket.off('disconnect', onDisconnect)` 명시적 호출 추가
  - 이벤트 핸들러를 명명된 함수로 추출하여 정확한 참조로 제거

### WARNING #7: 비동기 전환 후 기존 테스트 호환성
- **조치**: 새 테스트에서 `waitFor` 패턴을 적용하여 비동기 init 완료 대기

### INFO #2: 인라인 주석 부정확
- **조치**: `// player_uuid 쿠키를 먼저 생성한 후 소켓 연결` → `// /player/me 호출로 서버가 player_uuid 쿠키를 설정하게 한 뒤 소켓 연결`로 수정

### INFO #3: 변수명 `s`가 불명확
- **조치**: `const s = getSocket()` → `const newSocket = getSocket()`으로 변경

### INFO #9: setSocket 후 이벤트 리스너 등록 순서 문제
- **조치**: 리스너 등록 → `connect()` → `setSocket()` 순서로 변경

## 보류 항목 (중기 과제)

### WARNING #4: GET /player/me의 상태 변경 사이드 이펙트 (HTTP safe/idempotent 원칙 위반)
- **사유**: API 계약 변경은 백엔드와 프론트엔드 동시 수정이 필요하며, 현재 동작에 영향 없음
- **향후 계획**: `POST /player/session` 엔드포인트 분리 검토

### WARNING #5: SocketProvider SRP 위반 (플레이어 초기화 책임 겸임)
- **사유**: Provider 구조 변경은 관련 컴포넌트 전체 리팩토링 필요
- **향후 계획**: `PlayerInitProvider` 분리 검토

### WARNING #6: 매 마운트마다 불필요한 HTTP 요청
- **사유**: 성능 최적화는 현재 기능 정상 동작 확인 후 진행
- **향후 계획**: `document.cookie`에서 `player_uuid` 존재 여부 확인 후 조건부 fetch

## 검증 결과
- ESLint: 통과
- 전체 테스트: 46건 통과 (5 파일)
