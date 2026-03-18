## 발견사항

### [WARNING] 페이지네이션 경쟁 조건 (Race Condition)
- **위치**: `frontend/app/hall-of-fame/page.tsx`, `fetchRankings` 내부 (line 24~42)
- **상세**: `page` 상태가 변경될 때마다 비동기 fetch가 발생하지만, AbortController나 취소 메커니즘이 없습니다. 사용자가 빠르게 page 1 → 2 → 3을 클릭하면 세 요청이 동시에 진행되고, 네트워크 지연에 따라 응답 순서가 역전될 수 있습니다. page 3의 응답보다 page 1의 응답이 늦게 도착하면 오래된 데이터가 화면에 표시됩니다.
- **제안**:
```typescript
useEffect(() => {
  const controller = new AbortController();
  const fetchRankings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`...`, {
        credentials: 'include',
        signal: controller.signal,
      });
      const data = await res.json();
      setEntries(data.data ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) {
      if (!controller.signal.aborted) setEntries([]);
    }
    if (!controller.signal.aborted) setLoading(false);
  };
  fetchRankings();
  return () => controller.abort();
}, [page]);
```

---

### [INFO] 언마운트 후 소켓 콜백 실행 가능성
- **위치**: `frontend/src/hooks/useRoomList.ts` (line 18~21), `frontend/app/page.tsx` (handleJoin, handleCreate)
- **상세**: `socket.emit()`의 acknowledgement 콜백은 컴포넌트 언마운트 후에도 실행될 수 있습니다. cleanup에서 `socket.off()`로 이벤트 리스너는 제거하지만, 이미 진행 중인 emit 콜백은 취소되지 않아 언마운트된 컴포넌트의 상태 세터(`setRoomList`, `router.push`)가 호출될 수 있습니다. React 18에서는 에러를 발생시키지 않지만, 의도치 않은 부작용이 발생할 수 있습니다.
- **제안**: `mounted` ref 플래그를 사용하거나, Zustand store 업데이트는 컴포넌트 외부 상태이므로 `setRoomList`는 허용하되 `router.push` 등 UI 전환은 ref로 보호.

---

### [INFO] 모듈 수준 `toastId` 공유
- **위치**: `frontend/src/providers/ToastProvider.tsx` (line 23)
- **상세**: `let toastId = 0`이 모듈 수준에 선언되어 있어, 테스트 환경이나 React StrictMode의 이중 마운트 시 여러 `ToastProvider` 인스턴스가 같은 카운터를 공유합니다. JavaScript는 단일 스레드이므로 실제 경쟁 조건은 없지만, ID 중복/충돌 가능성은 없는지 고려가 필요합니다.
- **제안**: `useRef`를 사용하거나 `crypto.randomUUID()` 등으로 대체.

---

### [INFO] React StrictMode에서 소켓 싱글턴 문제
- **위치**: `frontend/src/lib/socket.ts`, `frontend/src/providers/SocketProvider.tsx`
- **상세**: React StrictMode(개발 환경)에서는 effect가 두 번 실행됩니다. `SocketProvider`의 cleanup에서 `disconnectSocket()`이 모듈 수준 `socket` 변수를 `null`로 초기화하지만, 컴포넌트 state는 이전 소켓 참조를 보유할 수 있습니다. 두 번째 마운트 시 `getSocket()`은 새 소켓을 생성하므로 연결이 정상 복구되지만, 첫 번째 마운트와 두 번째 마운트 사이에 이미 등록된 이벤트 리스너(`IdentityProvider` 등)가 무효화됩니다.
- **제안**: 현재 구조에서 `Providers` 트리가 단일 인스턴스로 보장된다면 실제 문제는 없지만, 소켓 생성을 Provider 내부로 이동시켜 모듈 싱글턴에 의존하지 않는 방식을 고려할 수 있습니다.

---

## 요약

전반적으로 이 프론트엔드 코드는 JavaScript 단일 스레드 환경의 특성상 데드락이나 스레드 안전성 문제는 없습니다. 가장 주의가 필요한 부분은 `hall-of-fame/page.tsx`의 **페이지네이션 경쟁 조건**으로, 빠른 페이지 전환 시 오래된 응답이 최신 응답을 덮어쓸 수 있습니다. 나머지는 언마운트 후 비동기 콜백 처리 등 일반적인 React 비동기 패턴의 개선 여지로, 안정성에 직접적인 영향은 제한적입니다.

## 위험도

**LOW** (페이지네이션 경쟁 조건이 존재하나 기능 정확성에 영향 가능, 나머지는 INFO 수준)