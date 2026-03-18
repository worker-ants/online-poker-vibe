## 발견사항

---

### [CRITICAL] Modal 전역 DOM 상태 충돌

- **위치**: `Modal.tsx`, `useEffect` (lines 10-17)
- **상세**: `document.body.style.overflow = 'hidden'` 을 직접 수정합니다. `HelpModal`과 다른 모달이 동시에 열린 상태에서 하나를 닫으면, 열려있는 나머지 모달과 무관하게 `overflow = ''`로 리셋됩니다. 현재 코드베이스에서 `HelpModal`은 `TopNav` 내부에 있고, 향후 중첩 모달이 추가되면 즉시 충돌합니다.
- **제안**: 열려있는 모달 수를 ref/counter로 추적하거나, `overflow` 복원 시 기존 값을 저장/복원하는 방식 사용

```tsx
// 수정 전
document.body.style.overflow = 'hidden';
// 수정 후 (값 저장)
const prev = document.body.style.overflow;
document.body.style.overflow = 'hidden';
return () => { document.body.style.overflow = prev; };
```

---

### [WARNING] BettingControls 렌더 중 setState 호출

- **위치**: `BettingControls.tsx`, lines 13-17
- **상세**: 렌더 함수 본문에서 `setPrevMinRaise`와 `setRaiseAmount`를 직접 호출합니다. React는 이 패턴을 허용하지만 즉시 재렌더를 트리거합니다. `minRaise`가 빠르게 변하는 게임 상황(타이머, 연속 베팅)에서 이중 렌더가 반복되어 퍼포먼스 저하 및 시각적 깜빡임이 발생할 수 있습니다.
- **제안**: `useEffect`로 이동

```tsx
useEffect(() => {
  setRaiseAmount(actionRequired.minRaise);
}, [actionRequired.minRaise]);
```

---

### [WARNING] ToastProvider setTimeout 미정리

- **위치**: `ToastProvider.tsx`, `addToast` (line 23)
- **상세**: `setTimeout` 반환값을 저장하지 않아 컴포넌트 언마운트 시 타이머가 정리되지 않습니다. 언마운트 후 4초 뒤 `setToasts`가 호출됩니다. React 18에서는 에러가 발생하지 않지만 의도치 않은 상태 업데이트입니다.
- **제안**: `useRef`에 타이머 ID 저장 후 cleanup 또는 `useCallback` 내에서 정리

---

### [WARNING] SocketProvider 이벤트 핸들러 - 언마운트 후 호출 가능

- **위치**: `SocketProvider.tsx`, `init()` (lines 30-51)
- **상세**: `newSocket.connect()` 호출 후 `if (cancelled)` 체크 사이에 `connect` 이벤트가 발생하면 `onConnect`가 호출되어 언마운트된 컴포넌트의 `setIsConnected(true)`가 실행됩니다. 또한 cleanup에서 `currentSocket.off(...)` 후에도 비동기로 수신된 이벤트가 핸들러를 호출할 수 있습니다.
- **제안**: `cancelled` 플래그를 핸들러 내부에서도 확인

```ts
const onConnect = () => { if (!cancelled) setIsConnected(true); };
const onDisconnect = () => { if (!cancelled) setIsConnected(false); };
```

---

### [WARNING] IdentityProvider setNickname - Promise 미해결 가능성

- **위치**: `IdentityProvider.tsx`, `setNickname` useCallback (lines 36-53)
- **상세**: `socket.emit(..., callback)` 방식에서 소켓이 연결 중 끊기면 서버 ACK 콜백이 영원히 호출되지 않아 Promise가 resolve/reject되지 않고 메모리에 남습니다. `NicknameInput`의 `isSubmitting` 상태가 영구적으로 `true`로 고정됩니다.
- **제안**: 타임아웃 추가 또는 `socket.once('disconnect', ...)` 리스너로 reject 처리

---

### [WARNING] NicknameInput 비동기 상태 업데이트 - 언마운트 후

- **위치**: `NicknameInput.tsx`, `handleSubmit` (lines 15-27)
- **상세**: `await setNickname(trimmed)` 대기 중 컴포넌트가 언마운트되면, 이후 `setIsSubmitting(false)`, `setIsEditing(false)` 호출이 발생합니다. React 18에서 에러는 아니지만 불필요한 상태 업데이트입니다.
- **제안**: `useRef`로 마운트 여부 추적 또는 `AbortController` 활용

---

### [WARNING] CreateRoomModal 폼 상태 미초기화

- **위치**: `CreateRoomModal.tsx`, `handleSubmit` / `onClose`
- **상세**: 모달을 제출하거나 취소해도 `name`, `variant`, `mode` 등의 로컬 상태가 초기화되지 않습니다. 다음 번 모달 열기 시 이전 입력값이 그대로 남아 있습니다. 의도된 UX인지 불명확합니다.
- **제안**: 의도적이라면 명시적 주석 추가, 아니라면 `onClose` 시 상태 초기화

---

### [INFO] PlayerSeat, CommunityCards - 배열 인덱스 key 사용

- **위치**: `PlayerSeat.tsx` (lines 41-52), `CommunityCards.tsx` (lines 10-16)
- **상세**: `key={i}` (배열 인덱스)를 사용하면 카드가 추가/제거될 때 React가 컴포넌트를 재사용하여 카드 애니메이션 또는 상태가 잘못된 카드에 연결될 수 있습니다.
- **제안**: `key={`${card.suit}-${card.rank}`}` 처럼 고유 카드 식별자 사용

---

### [INFO] socket.ts 모듈 레벨 싱글톤

- **위치**: `socket.ts`, `let socket: Socket | null = null`
- **상세**: 모듈 레벨 전역 변수입니다. `SocketProvider`의 `disconnectSocket()` 호출이 전역 상태를 `null`로 설정하므로, 테스트 간 격리가 되지 않으며 `SocketProvider`가 두 번 마운트되면 (HMR, StrictMode) 예상치 못한 소켓 재생성이 발생할 수 있습니다. 현재 테스트는 모듈을 모킹하여 이를 우회하고 있습니다.

---

### [INFO] betting-round.ts JSON 클론의 한계

- **위치**: `BettingRound.cloneState()` (line 203)
- **상세**: `JSON.parse(JSON.stringify(state))`는 현재 `GameState` 타입에는 안전하지만, 향후 `undefined` 필드나 함수, `Date` 객체가 추가되면 데이터가 손실됩니다.
- **제안**: 구조적으로 안전한 `structuredClone(state)` 사용을 권장

---

## 요약

전반적으로 코드는 React 및 NestJS의 패턴을 잘 따르고 있으나, **공유 DOM 상태(body.overflow)**와 **비동기 작업 후 언마운트된 컴포넌트 상태 업데이트**가 반복적으로 나타나는 패턴상의 문제가 있습니다. 가장 즉각적인 위험은 `Modal`의 `document.body.style.overflow` 전역 수정으로, 중첩 모달 또는 동시 모달 사용 시 반드시 충돌합니다. `BettingControls`의 렌더 중 setState, `ToastProvider`의 타이머 미정리, `IdentityProvider`의 미해결 Promise는 게임 플레이 중 예상치 못한 UI 동결이나 메모리 누수로 이어질 수 있습니다.

## 위험도

**MEDIUM**