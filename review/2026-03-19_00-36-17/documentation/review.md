### 발견사항

---

**[WARNING] BettingControls.tsx - 렌더 중 상태 업데이트 패턴에 설명 부재**
- 위치: `BettingControls.tsx:12-15`
- 상세: `prevMinRaise`를 이용한 렌더 중 setState 호출은 React에서 매우 비표준적인 패턴입니다. 이 패턴이 왜 `useEffect` 대신 선택되었는지 설명이 없어 유지보수 시 혼란을 줄 수 있습니다.
- 제안:
  ```tsx
  // Synchronize raiseAmount when minRaise prop changes.
  // useEffect causes a flicker (extra render after mount), so we use
  // the derived-state-from-props pattern recommended by React docs:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (prevMinRaise !== actionRequired.minRaise) {
  ```

---

**[WARNING] SocketProvider.tsx - 아키텍처 결정 주석이 한국어 단일 언어로만 작성됨**
- 위치: `SocketProvider.tsx:25-29`
- 상세: `/player/me` 를 소켓 연결 전에 호출하는 이유가 한국어 주석으로만 설명되어 있습니다. 쿠키 기반 인증 플로우라는 중요한 아키텍처 결정이며, fetch 실패 시에도 소켓 연결을 시도하는 이유에 대한 설명도 불충분합니다.
- 제안: 영어 또는 한/영 병기로 다음 내용을 명시
  ```tsx
  // Call /player/me first so the server sets the player_uuid cookie
  // via HTTP (required for socket.io auth via cookies).
  // If fetch fails, proceed anyway — the cookie may already exist.
  ```

---

**[WARNING] game.types.ts - HandCategory enum 랭킹 값의 근거 미문서화**
- 위치: `game.types.ts:HAND_CATEGORY_RANKS`
- 상세: `HAND_CATEGORY_RANKS`가 각 핸드에 1~10 값을 부여하지만, 이 숫자들이 비교 연산에 어떻게 활용되는지 설명이 없습니다. `ai-player.service.ts`의 `scoreMap`에서도 동일한 숫자를 사용하지만 두 곳에서 독립적으로 정의되어 있어 불일치 위험이 있습니다.
- 제안:
  ```ts
  // Hand category ranks for comparison: higher = stronger.
  // Must stay in sync with AiPlayerService.evaluateHandStrength scoreMap.
  export const HAND_CATEGORY_RANKS: Record<HandCategory, number> = { ... };
  ```

---

**[WARNING] ai-player.service.ts - evaluateHandStrength scoreMap 매직 넘버 미문서화**
- 위치: `ai-player.service.ts:167-178`
- 상세: `scoreMap`의 각 값(0.1, 0.3, 0.5 등)이 어떤 기준으로 결정되었는지 설명이 없습니다. categoryRank가 `HAND_CATEGORY_RANKS`와 연결됨을 명시하지 않아 두 값이 분리될 경우 버그 추적이 어렵습니다.
- 제안:
  ```ts
  // Maps HandCategory.categoryRank (1-10) to a [0,1] bluff/fold threshold.
  // Values are heuristic: calibrated so AI folds medium hands under pressure.
  // Must stay aligned with HAND_CATEGORY_RANKS in game.types.ts.
  ```

---

**[WARNING] PotDisplay.tsx - 사이드팟 표시 조건(> 1) 미문서화**
- 위치: `PotDisplay.tsx:14`
- 상세: `sidePots.length > 1` 조건이 > 0이 아닌 이유가 불명확합니다. 사이드팟이 1개면 메인팟과 동일하다는 도메인 지식이 없으면 버그처럼 보일 수 있습니다.
- 제안:
  ```tsx
  {/* Only show side pots when there are 2+: a single side pot equals the main pot */}
  {sidePots && sidePots.length > 1 && (
  ```

---

**[INFO] betting-round.ts - JSDoc이 일부 메서드에만 적용됨**
- 위치: `betting-round.ts` - `isOnlyOnePlayerRemaining`, `resetForNewRound`, `findNextActivePlayer`, `cloneState`
- 상세: 공개 메서드 중 일부(`findNextActivePlayer`)는 JSDoc이 없으며, `cloneState`(private)가 deep clone임을 명시하지 않습니다. `applyAction`의 JSDoc은 "immutable style"이라고 설명하지만 내부에서 cloned state를 직접 변경하는 방식으로 동작합니다.
- 제안:
  ```ts
  /**
   * Find the index of the next player who can act (not folded, not all-in).
   * Returns -1 if no such player exists.
   */
  findNextActivePlayer(state: GameState, fromIndex: number): number {
  ```

---

**[INFO] constants.ts (frontend) - 이벤트 구분 주석 누락**
- 위치: `frontend/src/lib/constants.ts`
- 상세: 백엔드의 `events.types.ts`는 `// Client → Server`, `// Server → Client` 주석으로 이벤트를 구분하지만, 프론트엔드의 `constants.ts`에는 동일한 구분이 없습니다.
- 제안: 백엔드와 동일한 섹션 주석 추가

---

**[INFO] socket.ts - 재연결 설정값 근거 미문서화**
- 위치: `socket.ts:10-13`
- 상세: `reconnectionAttempts: 10`, `reconnectionDelay: 1000`, `reconnectionDelayMax: 5000` 값이 어떤 기준으로 선택되었는지 설명이 없습니다.
- 제안:
  ```ts
  reconnectionAttempts: 10,   // ~50s max retry window
  reconnectionDelay: 1000,    // 1s initial backoff
  reconnectionDelayMax: 5000, // cap at 5s per attempt
  ```

---

**[INFO] HelpModal.tsx - 하드코딩된 게임 룰 데이터 출처 미명시**
- 위치: `HelpModal.tsx:HAND_RANKINGS`, `VARIANT_RULES`
- 상세: 게임 룰 데이터가 하드코딩되어 있으며, spec 문서나 다른 소스와의 연관성이 명시되지 않습니다. 게임 룰이 변경될 경우 이 파일도 수동으로 업데이트해야 함을 알 수 없습니다.
- 제안: 파일 상단 또는 상수 위에 `// Keep in sync with spec/game-rules.md` 형식의 주석 추가

---

**[INFO] useGameStore.ts - reset()에서 roomList를 보존하는 이유 미문서화**
- 위치: `useGameStore.ts:reset()`
- 상세: `reset()`이 `roomList`는 초기화하지 않는 이유가 불명확합니다. 의도적 설계인지 실수인지 알 수 없습니다.
- 제안:
  ```ts
  // Resets game session state but preserves roomList
  // so the lobby can continue showing available rooms.
  reset: () => set({ ... }),
  ```

---

### 요약

전반적으로 코드는 간결하고 자기 설명적으로 작성되어 있으며, 백엔드의 `betting-round.ts`와 `deck.ts`는 JSDoc이 잘 적용된 편입니다. 그러나 **아키텍처 결정**이나 **도메인 지식**이 필요한 부분—특히 SocketProvider의 쿠키 초기화 플로우, BettingControls의 렌더 중 상태 갱신 패턴, scoreMap의 매직 넘버, PotDisplay의 `> 1` 조건—에 설명이 없어 유지보수 시 혼란을 야기할 수 있습니다. 또한 `game.types.ts`의 `HAND_CATEGORY_RANKS`와 `ai-player.service.ts`의 `scoreMap`이 두 곳에서 독립적으로 정의되어 동기화 문제가 발생할 수 있는 점은 문서화만으로 해결하기 어렵고 리팩터링이 필요한 부분입니다.

### 위험도

**LOW**