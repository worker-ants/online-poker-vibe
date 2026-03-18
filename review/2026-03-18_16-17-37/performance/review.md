## 발견사항

### **[WARNING]** `useRoomList` - 구독 분리로 인한 이중 Zustand 구독
- 위치: `frontend/src/hooks/useRoomList.ts:11-12`
- 상세: `roomList`와 `setRoomList`를 별도 `useGameStore` 구독으로 조회. `setRoomList`는 안정적인 참조이므로 매번 재구독할 필요 없음.
- 제안:
  ```ts
  const { roomList, setRoomList } = useGameStore();
  ```
  또는 Zustand의 `getState()`로 setter를 직접 추출:
  ```ts
  const roomList = useGameStore((s) => s.roomList);
  const setRoomList = useGameStore.getState().setRoomList;
  ```

---

### **[WARNING]** `HallOfFamePage` - 플레이어 히스토리 미캐싱
- 위치: `frontend/app/hall-of-fame/page.tsx:44-56`
- 상세: `handlePlayerClick`이 동일 uuid를 반복 클릭해도 매번 fetch 재요청. 모달을 닫고 다시 열면 불필요한 네트워크 요청 발생.
- 제안: Map으로 히스토리 캐시:
  ```ts
  const [historyCache, setHistoryCache] = useState<Map<string, GameHistoryEntry[]>>(new Map());
  ```

---

### **[WARNING]** `CommunityCards` - 매 렌더마다 빈 배열 생성
- 위치: `frontend/src/components/game/table/CommunityCards.tsx:20`
- 상세: `Array.from({ length: 5 - cards.length })` 가 렌더마다 새 배열 생성. 게임 상태 업데이트 시 빈번히 호출될 컴포넌트.
- 제안: `useMemo` 또는 `memo` 래핑으로 cards 배열이 변경될 때만 재계산.

---

### **[WARNING]** `PokerTable` - 매 렌더마다 플레이어 배열 재생성
- 위치: `frontend/src/components/game/table/PokerTable.tsx:29-33`
- 상세: `[...gameState.players]` spread + splice가 매 렌더마다 실행. `gameState.players`가 참조 동일해도 새 배열 생성.
- 제안: `useMemo`로 `reorderedPlayers` 메모이제이션:
  ```ts
  const reorderedPlayers = useMemo(() => {
    const arr = [...gameState.players];
    const myIdx = arr.findIndex((p) => p.uuid === myUuid);
    if (myIdx > 0) arr.push(...arr.splice(0, myIdx));
    return arr;
  }, [gameState.players, myUuid]);
  ```

---

### **[INFO]** `BettingControls` - `raiseAmount` 초기값 비동기 반영 문제
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx:13`
- 상세: `useState(actionRequired.minRaise)` 초기값은 최초 마운트 시 한 번만 반영. 턴마다 `actionRequired.minRaise`가 변경되어도 `raiseAmount`는 갱신 안 됨.
- 제안:
  ```ts
  useEffect(() => {
    setRaiseAmount(actionRequired.minRaise);
  }, [actionRequired.minRaise]);
  ```

---

### **[INFO]** `Modal` - `body.style.overflow` DOM 직접 조작
- 위치: `frontend/src/components/shared/Modal.tsx:13-21`
- 상세: 다중 모달이 동시에 열릴 경우(예: HelpModal + PlayerHistoryModal) 중첩 cleanup에서 overflow가 잘못 복원될 수 있음. 참조 카운팅 없는 전역 DOM 조작.
- 제안: 카운터 기반 접근 또는 `overflow-hidden` 클래스를 body에 토글하는 공유 유틸리티 사용.

---

### **[INFO]** `ToastProvider` - `setTimeout` 클로저 누수 가능성
- 위치: `frontend/src/providers/ToastProvider.tsx:29-32`
- 상세: 컴포넌트 언마운트 후 setTimeout이 실행되면 `setToasts`를 호출하지만, React 18 이후에는 경고만 발생하므로 낮은 위험도. 단, cleanup 없음.
- 제안:
  ```ts
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  // cleanup: clearTimeout(timerRef.current)
  ```

---

### **[INFO]** `RankingsTable` - `toLocaleString` 매 행마다 호출
- 위치: `frontend/src/components/hall-of-fame/RankingsTable.tsx:59-61`
- 상세: 20개 행 × 2개 날짜 포맷 = 40회 `toLocaleString` 호출. `Intl.DateTimeFormat` 인스턴스 생성이 반복됨.
- 제안: 포맷터를 모듈 스코프에서 한 번만 생성:
  ```ts
  const formatter = new Intl.DateTimeFormat('ko-KR', { ... });
  ```

---

## 요약

프론트엔드 코드는 전반적으로 React 패턴을 잘 따르고 있으나, 성능 측면에서 세 가지 주요 개선점이 있습니다. (1) `PokerTable`과 `CommunityCards`에서 `useMemo` 부재로 인해 게임 상태 업데이트마다 불필요한 배열 재생성이 발생하며, 이는 포커 게임의 실시간 특성상(초당 수회 WebSocket 이벤트) 잠재적 렌더링 병목이 됩니다. (2) Hall of Fame의 플레이어 히스토리 미캐싱은 UX와 네트워크 효율 모두에 영향을 줍니다. (3) `BettingControls`의 `raiseAmount` 초기화 버그는 기능적 결함이 동반된 성능 문제입니다. 나머지 이슈들은 낮은 위험도이며 전체적인 아키텍처(Zustand + Context 분리, Socket 싱글톤, 메모리 게임 상태)는 성능을 고려한 올바른 설계입니다.

## 위험도

**LOW**