## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `processAiTurnsOrNotify`의 동기식 루프가 WebSocket 이벤트 루프를 블로킹할 수 있음
- **위치**: `room.gateway.ts` — `processAiTurnsOrNotify()` 메서드
- **상세**: `while(true)` 루프 내에서 `await this.gameService.handleAction()`을 순차적으로 호출. AI 플레이어가 여러 명이거나 체인이 길어질 경우 (예: 5명 AI가 연속으로 폴드 없이 진행) NestJS의 비동기 이벤트 루프에서 단일 요청이 오래 점유됨. 특히 AI들이 서로 레이즈를 주고받는 긴 핸드에서 수십 번의 루프가 발생 가능.
- **제안**: 루프 내에 `await new Promise(r => setImmediate(r))`를 삽입하여 이벤트 루프에 제어권을 돌려주는 yield point 확보. 또는 최대 반복 횟수 guard 추가.

---

**[WARNING]** `getGameResult`에서 `topChips` 계산 시 반복적인 `filter` 호출
- **위치**: `game.service.ts` — `getGameResult()`, `finishGame()`
- **상세**: `sortedPlayers.map()` 내부에서 각 플레이어마다 `sortedPlayers.filter(sp => sp.chips === topChips).length`를 호출 — O(n²). 플레이어 수가 최대 6명이라 현재는 실질적 영향 없으나, `finishGame()`에도 동일 패턴이 중복 존재.
- **제안**: 루프 전에 `const topCount = sortedPlayers.filter(p => p.chips === topChips).length`를 한 번만 계산.

---

**[WARNING]** `isAiPlayer(p.uuid)` 가 `getPublicState`의 `.map()` 내부에서 매번 호출됨
- **위치**: `game.service.ts:196` — `getPublicState()` → `state.players.map()`
- **상세**: `isAiPlayer()`는 `String.prototype.startsWith()` 호출로 자체는 O(1)이지만, `getPublicState()`는 WebSocket 브로드캐스트마다 호출됨. AI 액션 루프에서 각 AI 턴마다 `getPublicState`가 호출되므로 루프 횟수만큼 반복.
- **제안**: 게임 시작 시 AI 여부를 `PlayerState`에 캐싱하거나 `Set<string>`으로 AI UUID를 보관하여 O(1) 조회.

---

**[INFO]** `evaluateHandStrength`에서 `scoreMap` 객체가 매 호출마다 새로 생성됨
- **위치**: `ai-player.service.ts` — `evaluateHandStrength()` 내부 `scoreMap`
- **상세**: `const scoreMap: Record<number, number> = { ... }` 가 AI 턴마다 호출될 때마다 새로운 객체를 힙에 할당. AI가 5명이고 핸드당 4 라운드라면 수십 번 할당.
- **제안**: `scoreMap`을 클래스 레벨 `readonly` 상수로 추출하여 재사용.

```typescript
private static readonly SCORE_MAP: Record<number, number> = {
  1: 0.1, 2: 0.3, 3: 0.5, ...
};
```

---

**[INFO]** `getDiscardIndices`에서 `.map()` + `.filter()` 체인이 반복적으로 사용됨
- **위치**: `ai-player.service.ts` — `getDiscardIndices()`
- **상세**: `holeCards.map((_, i) => i).filter(...)` 패턴이 3회 등장. 5장 고정이라 실질 비용은 미미하나 불필요한 임시 배열 생성.
- **제안**: `for` 루프로 직접 인덱스 수집하거나 유틸 함수로 추출.

---

**[INFO]** `hall-of-fame.service.ts`의 `playerUuid NOT LIKE 'ai-%'` 조건은 인덱스를 사용하지 못할 수 있음
- **위치**: `hall-of-fame.service.ts:56, 87`
- **상세**: `LIKE 'ai-%'`는 prefix 패턴이므로 대부분의 DB에서 인덱스 스캔 가능하나, SQLite에서는 `playerUuid` 컬럼에 인덱스가 없으면 full scan. 랭킹 쿼리는 집계 쿼리로 이미 무거운데, 필터링이 인덱스를 타지 않으면 성능 저하.
- **제안**: `playerUuid`에 인덱스 확인. 또는 AI 레코드를 애초에 DB에 저장하지 않는 현재 설계(스펙 준수)를 유지하면 이 필터 자체가 방어 코드로서만 작동하므로 실제 영향은 낮음.

---

### 요약

전반적으로 AI 플레이어 기능 구현의 성능은 수용 가능한 수준입니다. 가장 주목할 이슈는 `processAiTurnsOrNotify`의 동기 루프로, 여러 AI가 연속으로 행동할 때 Node.js 이벤트 루프를 일시 점유할 수 있습니다. 최대 플레이어 수(6명)와 포커 구조상 단일 루프 실행이 길어질 가능성은 제한적이지만, `setImmediate`를 통한 yield point 추가로 안전하게 개선할 수 있습니다. 나머지 이슈들(중복 filter, scoreMap 재생성 등)은 낮은 데이터 규모(최대 6명)로 인해 실제 영향이 미미하며, 코드 개선은 선택적으로 진행해도 무방합니다.

### 위험도

**LOW**