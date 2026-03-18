## Side Effect Code Review

### 발견사항

---

**[WARNING] 전역 소켓 싱글톤 — 모듈 레벨 변수 변이**
- 위치: `frontend/src/lib/socket.ts` (L6, L22-25)
- 상세: `let socket: Socket | null = null`이 모듈 레벨 전역 변수. `disconnectSocket()`이 `socket = null`로 초기화하나, `SocketProvider`의 cleanup에서 호출 후 컴포넌트가 재마운트되면(StrictMode의 double-invoke 포함) 새 소켓이 생성됨. 문제는 이전 소켓의 이벤트 리스너(connect/disconnect)가 여전히 이전 소켓 인스턴스에 바인딩되어 있으나 cleanup 전에 리스너 제거가 이루어지지 않음.
- 제안:
```typescript
return () => {
  s.off('connect');
  s.off('disconnect');
  disconnectSocket();
};
```

---

**[WARNING] `document.body.style.overflow` 전역 DOM 변이 경합**
- 위치: `frontend/src/components/shared/Modal.tsx` (L13-21)
- 상세: 여러 Modal이 동시에 열릴 경우(e.g. `HelpModal` + `PlayerHistoryModal`), 첫 번째 Modal이 닫히면 cleanup에서 `overflow = ''`로 복원되어 두 번째 Modal이 열린 상태에서도 스크롤이 풀림.
- 제안: 참조 카운터 방식 또는 `data-modal-count` attribute를 사용하거나, 모달이 닫힐 때 다른 모달이 열려있는지 확인 후 복원.

---

**[WARNING] `toastId` 전역 변수 — 모듈 간 공유 상태**
- 위치: `frontend/src/providers/ToastProvider.tsx` (L26)
- 상세: `let toastId = 0`이 모듈 레벨 전역 변수. HMR(Hot Module Replacement) 또는 테스트 환경에서 모듈이 재로드되어도 초기화되지 않거나, 반대로 재로드 시 0으로 리셋되어 ID 충돌 가능.
- 제안: `useRef`로 컴포넌트 인스턴스 범위로 한정.

---

**[WARNING] `BettingControls`의 `raiseAmount` 초기값 — prop 변경 미반영**
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx` (L13)
- 상세: `useState(actionRequired.minRaise)`로 초기화하면, `actionRequired`가 변경될 때(새 베팅 라운드, 다른 플레이어 raise 후) `raiseAmount`가 이전 값에 고정됨. `minRaise`가 상승해도 슬라이더의 value가 범위를 벗어날 수 있음.
- 제안:
```typescript
useEffect(() => {
  setRaiseAmount(actionRequired.minRaise);
}, [actionRequired.minRaise]);
```

---

**[INFO] `next.config.ts` rewrite — 하드코딩된 localhost URL**
- 위치: `frontend/next.config.ts` (L6)
- 상세: `destination: 'http://localhost:3000/:path*'`가 하드코딩됨. 프로덕션 배포 시 환경 변수를 참조하지 않아 배포 환경에서 rewrite가 잘못된 주소로 향함. 단, `BACKEND_URL`은 `constants.ts`에서 `NEXT_PUBLIC_BACKEND_URL` 환경 변수를 참조하므로 이 rewrite 설정은 실제로 사용되지 않을 가능성이 높음 (프론트에서 직접 `BACKEND_URL`로 fetch).
- 제안: rewrite 설정과 직접 fetch URL 전략 중 하나를 통일. 직접 fetch를 사용한다면 rewrite 제거 검토.

---

**[INFO] `useRoomList` — socket 변경 시 이전 리스너 누적 가능성**
- 위치: `frontend/src/hooks/useRoomList.ts` (L16-35)
- 상세: cleanup에서 `socket.off(WS_EVENTS.ROOM_LIST_UPDATE, handleUpdate)`를 올바르게 처리하나, `socket`이 재생성될 때(재연결) 이전 `socket.emit(ROOM_LIST, ...)`의 콜백이 stale closure로 동작할 수 있음. 실질적 위험은 낮으나 `setRoomList`가 stable ref이므로 문제 없음.

---

**[INFO] `CreateRoomModal` — onClose 후 상태 초기화 없음**
- 위치: `frontend/src/components/lobby/CreateRoomModal.tsx` (L38-42)
- 상세: `handleSubmit` 후 `onClose()`는 호출하지만 `name`, `variant` 등의 내부 상태를 초기화하지 않음. 모달이 닫혔다가 다시 열리면 이전에 입력한 값이 남아있음. UX 문제이나 부작용(side effect) 관점에서 의도적 설계일 수 있음.
- 제안: `onClose()` 전에 상태 초기화 추가, 또는 의도된 동작이라면 명시.

---

### 요약

전체적으로 코드는 React/Next.js 패턴을 잘 따르고 있으며 심각한 부작용은 없습니다. 주요 위험은 **모듈 레벨 전역 상태** (`socket` 싱글톤, `toastId`)가 React 생명주기 외부에서 관리되어 StrictMode나 HMR 환경에서 예상치 못한 동작을 일으킬 수 있는 점과, **`document.body.style.overflow` 공유 DOM 상태**가 여러 모달이 중첩될 경우 경합 조건을 만들 수 있는 점입니다. `BettingControls`의 stale `raiseAmount` 문제는 게임 플레이 중 실제로 발생할 수 있는 버그입니다.

### 위험도

**LOW**