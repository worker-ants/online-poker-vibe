## 발견사항

---

### **[WARNING]** SocketProvider: `onConnect`/`onDisconnect` 핸들러가 언마운트 이후 실행될 수 있음

- **위치:** `frontend/src/providers/SocketProvider.tsx`, `init()` 함수 내 `newSocket.connect()` 호출 이후
- **상세:**
  ```ts
  newSocket.connect(); // 비동기 소켓 연결 시작

  if (cancelled) {    // ← 이 체크와 connect() 사이에 컴포넌트가 언마운트될 수 있음
    // cleanup
    return;
  }
  setSocket(newSocket); // ← 언마운트 이후 도달 가능
  ```
  `connect()`는 비동기 I/O를 트리거하므로, socket.io의 `connect` 이벤트는 JS 이벤트 루프 다음 사이클에서 발생할 수 있다. cleanup 함수에서 `socket.off('connect', onConnect)`를 호출하지만, `setSocket(newSocket)` 자체가 `cancelled` 체크를 통과한 뒤 실행될 수 있는 창(window)이 존재한다.
- **제안:** `setSocket` 호출을 `newSocket.on('connect', ...)` 내부로 이동하거나, `cancelled` 체크를 `setSocket` 바로 앞에 한 번 더 추가:
  ```ts
  newSocket.connect();
  if (!cancelled) setSocket(newSocket);
  ```

---

### **[WARNING]** ToastProvider: `setTimeout` 미정리로 인한 언마운트 후 상태 업데이트

- **위치:** `frontend/src/providers/ToastProvider.tsx`, `addToast` 콜백
- **상세:**
  ```ts
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 4000);
  // 반환된 타이머 ID를 저장하지 않음 → clearTimeout 불가
  ```
  Provider가 언마운트되어도 4초 타이머가 계속 실행된다. `ToastProvider`는 앱 루트에 위치하므로 실제 언마운트 빈도는 낮지만, 타이머가 누적되거나 테스트 환경에서 문제가 될 수 있다.
- **제안:**
  ```ts
  const timerRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timerRefs.current.delete(timer);
    }, 4000);
    timerRefs.current.add(timer);
  }, []);

  useEffect(() => () => {
    timerRefs.current.forEach(clearTimeout);
  }, []);
  ```

---

### **[WARNING]** `socket.ts`: 모듈 수준 싱글턴과 React Strict Mode 이중 실행 충돌

- **위치:** `frontend/src/lib/socket.ts`
- **상세:**
  ```ts
  let socket: Socket | null = null;

  export function disconnectSocket(): void {
    if (socket) {
      socket.disconnect();
      socket = null; // ← 싱글턴 초기화
    }
  }
  ```
  React Strict Mode에서는 `useEffect`가 두 번 실행된다(mount → unmount → mount). 첫 번째 cleanup에서 `disconnectSocket()`이 `socket = null`로 초기화하면, 두 번째 mount에서 `getSocket()`은 새로운 소켓 인스턴스를 생성한다. 이 과정에서 첫 번째 소켓의 이벤트 핸들러가 아직 살아있을 경우 이벤트 중복 처리가 발생할 수 있다.
- **제안:** `SocketProvider.tsx`의 cleanup 순서를 보장하거나, 모듈 싱글턴 대신 `useRef`로 소켓 라이프사이클을 완전히 컴포넌트 내에서 관리.

---

### **[INFO]** `useRoomList`: 초기 `socket.emit` 콜백이 언마운트 이후에도 실행됨

- **위치:** `frontend/src/hooks/useRoomList.ts`
- **상세:**
  ```ts
  socket.emit(WS_EVENTS.ROOM_LIST, {}, (rooms: RoomInfo[]) => {
    if (Array.isArray(rooms)) {
      setRoomList(rooms); // ← cleanup이 이 콜백을 취소하지 않음
    }
  });
  ```
  `ROOM_LIST_UPDATE` 리스너는 cleanup에서 제거되지만, 최초 emit의 acknowledgement 콜백은 언마운트 이후에도 호출될 수 있다. `setRoomList`가 Zustand 스토어를 직접 업데이트하므로 React 경고는 없지만, 의도치 않은 전역 상태 변경이 발생할 수 있다.
- **제안:**
  ```ts
  let cancelled = false;
  socket.emit(WS_EVENTS.ROOM_LIST, {}, (rooms: RoomInfo[]) => {
    if (!cancelled && Array.isArray(rooms)) setRoomList(rooms);
  });
  return () => {
    cancelled = true;
    socket.off(WS_EVENTS.ROOM_LIST_UPDATE, handleUpdate);
  };
  ```

---

### **[INFO]** `BettingControls`: 렌더 중 `setState` 호출

- **위치:** `frontend/src/components/game/sidebar/BettingControls.tsx`
- **상세:**
  ```ts
  if (prevMinRaise !== actionRequired.minRaise) {
    setPrevMinRaise(actionRequired.minRaise); // ← 렌더 함수 내 setState
    setRaiseAmount(actionRequired.minRaise);
  }
  ```
  React 공식 문서에서 허용하는 "이전 props에서 파생된 state 동기화" 패턴이지만, 두 개의 `setState`를 순차적으로 호출하면 React가 중간 상태로 한 번 더 렌더링할 수 있다. 단일 `useEffect`를 사용하면 배치 처리가 보장된다.
- **제안:**
  ```ts
  useEffect(() => {
    setRaiseAmount(actionRequired.minRaise);
  }, [actionRequired.minRaise]);
  // prevMinRaise 상태 불필요
  ```

---

### **[INFO]** `betting-round.ts`: `JSON.parse/JSON.stringify` 딥 클론의 이벤트 루프 블로킹

- **위치:** `backend/src/game/engine/betting-round.ts`
- **상세:**
  ```ts
  private cloneState(state: GameState): GameState {
    return JSON.parse(JSON.stringify(state)) as GameState;
  }
  ```
  Node.js는 단일 스레드이므로 진정한 경쟁 조건은 없지만, `GameState`가 커질수록 이 동기 직렬화 작업이 이벤트 루프를 차단한다. 게임 액션마다 실행되므로 플레이어 수 증가 시 지연이 발생할 수 있다.
- **제안:** `structuredClone(state)` 사용 (Node.js 17+에서 네이티브 지원, 약 2~3배 빠름).

---

## 요약

전체적으로 프론트엔드는 React의 비동기 라이프사이클, 백엔드는 Node.js의 단일 스레드 모델을 기반으로 하기 때문에 멀티스레드 환경에서 발생하는 고전적인 경쟁 조건이나 데드락 위험은 없다. 그러나 **SocketProvider의 async 초기화 로직**에서 `cancelled` 플래그 체크 시점과 소켓 연결 시점 사이의 미세한 창, **ToastProvider의 타이머 미정리**, **React Strict Mode와 모듈 수준 소켓 싱글턴의 상호작용**이 주요 비동기 안전성 문제로 식별된다. `useRoomList`의 emit 콜백 누수와 `BettingControls`의 렌더 중 이중 setState는 실용적 위험도는 낮지만 React 관례상 개선이 권장된다.

## 위험도

**LOW**