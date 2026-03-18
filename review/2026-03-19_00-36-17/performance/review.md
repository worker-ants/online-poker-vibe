### 발견사항

---

#### [CRITICAL] BettingRound: JSON 직렬화 기반 딥 클론이 매 액션마다 실행됨

- **위치**: `backend/src/game/engine/betting-round.ts` — `cloneState()` (L168)
- **상세**: `JSON.parse(JSON.stringify(state))`은 게임 상태 전체(덱 최대 52장, `roundHistory` 무제한 축적, 모든 플레이어 상태)를 매 베팅 액션마다 직렬화/역직렬화합니다. `roundHistory`는 핸드가 진행될수록 계속 커지므로, 클론 비용도 핸드 후반부로 갈수록 선형적으로 증가합니다. 게임 속도가 빠른 AI 대결에서는 병목이 됩니다.
- **제안**: 구조적 공유(Immer 등) 또는 필요한 필드만 부분 클론하는 방식으로 전환. 최소한 `deck`와 `roundHistory` 전체를 매번 복사하지 않도록 참조를 분리하거나 `roundHistory`에는 `push()`만 사용하는 불변 구조로 변경.

---

#### [CRITICAL] Deck.shuffle(): 암호학적 RNG를 52번 syscall로 호출

- **위치**: `backend/src/game/engine/deck.ts` — `shuffle()` (L21)
- **상세**: `randomInt(i + 1)`는 Node.js `crypto` 모듈의 동기 함수로 매 호출마다 OS syscall이 발생합니다. Fisher-Yates 셔플에서 51번 호출하므로 한 번의 셔플에 51회 syscall이 발생합니다. 게임당 핸드 수가 많거나 AI 속도 테스트 시 누적 오버헤드가 큼.
- **제안**: 포커 셔플은 보안상 CSPRNG가 필수이나, 단일 호출로 충분한 엔트로피를 얻는 방식으로 개선 가능. 예: `crypto.getRandomValues(new Uint32Array(52))`로 한 번에 엔트로피 풀을 채운 뒤 Fisher-Yates에 활용하면 syscall을 1회로 줄일 수 있습니다.

---

#### [WARNING] PokerTable: 매 렌더마다 플레이어 배열 재정렬 및 새 배열 생성

- **위치**: `frontend/src/components/game/table/PokerTable.tsx` (L24-L30)
- **상세**: `gameState.players.findIndex()`와 스프레드 + `splice` 패턴이 `useMemo` 없이 렌더마다 실행됩니다. WebSocket 이벤트가 빈번한 게임 화면에서는 매 상태 업데이트마다 불필요한 배열 생성이 반복됩니다.
- **제안**:
  ```tsx
  const reorderedPlayers = useMemo(() => {
    const myIndex = gameState.players.findIndex((p) => p.uuid === myUuid);
    if (myIndex <= 0) return gameState.players;
    return [...gameState.players.slice(myIndex), ...gameState.players.slice(0, myIndex)];
  }, [gameState.players, myUuid]);
  ```

---

#### [WARNING] BettingControls: `prevMinRaise` 패턴으로 인한 추가 렌더 사이클

- **위치**: `frontend/src/components/game/sidebar/BettingControls.tsx` (L12-L16)
- **상세**: 렌더 도중 `setState`를 호출하는 패턴은 React가 동일 렌더 사이클 내 두 번 렌더를 수행하게 합니다(React 공식 문서에서 허용하지만 부작용 있음). 베팅 중 minRaise가 자주 변경되는 환경에서 불필요한 렌더 비용이 발생합니다.
- **제안**: `useEffect`로 변경:
  ```tsx
  useEffect(() => {
    setRaiseAmount(actionRequired.minRaise);
  }, [actionRequired.minRaise]);
  ```

---

#### [WARNING] CreateRoomModal: 렌더마다 인라인 상수 배열 재생성

- **위치**: `frontend/src/components/lobby/CreateRoomModal.tsx` (L63-L68, L82-L86)
- **상세**: 포커 변형 및 게임 모드 배열이 컴포넌트 함수 내부에 인라인으로 정의되어 렌더마다 새 배열 참조를 생성합니다. 모달이 열릴 때마다 리-렌더가 발생하므로 불필요한 GC 압박이 생깁니다.
- **제안**: 컴포넌트 외부 모듈 레벨로 이동.

---

#### [WARNING] RankingsTable / PlayerHistoryModal: 렌더마다 Date 객체 생성

- **위치**: `frontend/src/components/hall-of-fame/RankingsTable.tsx` (L57), `PlayerHistoryModal.tsx` (L38)
- **상세**: `new Date(entry.lastGameTime).toLocaleString('ko-KR')`가 각 행/항목마다 매 렌더에서 실행됩니다. 랭킹 테이블에 수십 개 항목이 있으면 렌더마다 수십 회 `Date` 객체 생성과 `toLocaleString` 포맷팅이 발생합니다.
- **제안**: `useMemo`로 전체 목록의 포맷된 날짜를 캐싱하거나, 별도의 `FormattedDate` 컴포넌트로 분리하여 `React.memo`로 감싸기.

---

#### [INFO] BettingRound: roundHistory 무제한 성장

- **위치**: `backend/src/game/engine/betting-round.ts` — `applyAction()` (L149)
- **상세**: `roundHistory.push()`로 게임 전체 액션 히스토리가 `GameState`에 축적됩니다. `cloneState()`가 이 히스토리를 매번 직렬화하므로, 핸드가 길어질수록 클론 비용이 증가합니다. 현재 `roundHistory`는 UI에 노출되지 않아 대부분 낭비입니다.
- **제안**: 라운드 완료 시점에 히스토리를 별도 스토리지로 이동하고 `GameState`에는 현재 라운드 액션만 유지.

---

#### [INFO] useRoomList: 두 번의 개별 Zustand 셀렉터 구독

- **위치**: `frontend/src/hooks/useRoomList.ts` (L9-L10)
- **상세**: `roomList`와 `setRoomList`를 각각 별도 `useGameStore()` 호출로 구독합니다. Zustand는 안정적인 참조를 보장하나, 단일 셀렉터로 합치면 구독 오버헤드를 절반으로 줄일 수 있습니다.
- **제안**: `const { roomList, setRoomList } = useGameStore((s) => ({ roomList: s.roomList, setRoomList: s.setRoomList }), shallow);`

---

#### [INFO] Deck.deal(): splice(0, n)의 O(n) 시프트 비용

- **위치**: `backend/src/game/engine/deck.ts` — `deal()` (L31)
- **상세**: `Array.splice(0, count)`는 제거한 요소 수만큼 나머지 요소를 앞으로 시프트합니다. 52장 덱에서는 O(52)로 무시할 수준이나, 구조 개선 시 인덱스 포인터 방식 고려 가능.
- **제안**: 현재 게임 규모에서는 문제 없음. 필요 시 `this.index` 포인터 패턴으로 전환.

---

### 요약

백엔드에서 가장 심각한 성능 위험은 **`BettingRound.cloneState()`의 JSON 직렬화 방식**과 **`Deck.shuffle()`의 반복 syscall**입니다. 특히 `roundHistory`가 매 핸드 누적되면서 `cloneState` 비용이 시간이 지날수록 증가하는 구조적 문제가 있습니다. 프론트엔드에서는 **`PokerTable`의 매 렌더 배열 재생성**이 WebSocket 이벤트가 잦은 게임 화면에서 실질적인 프레임 드롭을 일으킬 수 있습니다. `BettingControls`의 `prevMinRaise` 패턴도 불필요한 이중 렌더를 유발합니다. 나머지 이슈들은 현재 게임 규모(최대 6명)에서 체감 영향은 낮으나 코드 품질 관점에서 개선이 권장됩니다.

### 위험도

**HIGH**