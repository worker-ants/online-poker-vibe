## 부작용(Side Effect) 코드 리뷰

### 발견사항

---

**[INFO]** `import` 스타일 정리 (파일 1, 2)
- 위치: `game.entity.ts`, `create-room.dto.ts`
- 상세: 멀티라인 `import type { ... }` → 단일라인 형식으로 변경. 순수 포맷팅 변경이며 컴파일 결과, 타입 해석, 런타임 동작 모두 동일.
- 제안: 변경 없음. 안전.

---

**[WARNING]** `RoomState` 인터페이스에 `settings` 필드 추가 (파일 4)
- 위치: `frontend/src/lib/types.ts:42`
- 상세: `RoomState`에 `settings: RoomSettings`가 **필수(non-optional)** 필드로 추가됨. 기존 코드에서 `RoomState` 객체를 직접 생성하는 곳(테스트 픽스처, mock 데이터 등)은 모두 `settings` 필드가 없으면 TypeScript 컴파일 오류가 발생함. 백엔드가 `settings`를 실제로 응답에 포함시키는지, 그리고 모든 기존 테스트 픽스처가 갱신되었는지 확인 필요.
- 제안: 백엔드 `room.gateway.ts` / `room.service.ts`의 `getRoomState()` 응답에 `settings`가 포함됨을 확인. 미확인 시 `settings?: RoomSettings`로 optional로 선언하거나 기존 픽스처를 모두 갱신.

---

**[INFO]** `GameRulesPanel` 신규 삽입 — 사이드바 레이아웃 영향 (파일 3)
- 위치: `frontend/app/game/[roomId]/page.tsx:179`
- 상세: 사이드바 최상단에 `GameRulesPanel`이 추가됨. `PlayerList`, `BettingControls`, 준비/포기 버튼과 함께 렌더링되므로 전체 사이드바 높이가 증가. 좁은 뷰포트에서 스크롤 없이 `BettingControls`가 잘릴 수 있음. `currentRoom && <GameRulesPanel ...>` 조건부 렌더링은 적절하며, 불필요한 리렌더는 없음.
- 제안: 사이드바에 `overflow-y-auto`가 이미 적용되어 있는지 확인. 없다면 추가 권장.

---

**[INFO]** `showSchedule` 조건 타입 (파일 7)
- 위치: `GameRulesPanel.tsx:20`
- 상세: `settings.blindSchedule?.length`는 `number | undefined`를 반환하므로 `truthy` 평가로 동작. 빈 배열(`[]`)인 경우 `0`으로 falsy 처리되어 스케줄 UI가 렌더링되지 않음 — 의도된 동작으로 보임. 다만 TypeScript strict 환경에서 `boolean`으로 캐스팅이 필요한 경우가 있음.
- 제안: 명시성을 위해 `(settings.blindSchedule?.length ?? 0) > 0`으로 작성 고려.

---

**[INFO]** `formatNumber`의 locale 의존성 (파일 7)
- 위치: `GameRulesPanel.tsx:11`
- 상세: `toLocaleString()`은 브라우저/Node.js 환경의 locale 설정에 따라 결과가 다름. 테스트 환경(Vitest + jsdom)에서는 `1,000`으로 출력되지만, 일부 CI 환경(locale=C 등)에서는 `1000`으로 출력되어 `expect(screen.getByText('1,000'))`가 실패할 수 있음.
- 제안: 테스트 환경 locale을 고정(`vi.stubGlobal`로 `Intl` mock)하거나, `toLocaleString('en-US')`처럼 locale을 명시 지정.

---

### 요약

이번 변경의 핵심은 `RoomState`에 `settings` 필드를 필수로 추가하고 신규 `GameRulesPanel` 컴포넌트를 사이드바에 삽입하는 것이다. 전역 상태 변경, 네트워크 호출, 파일시스템 부작용은 전혀 없다. 주요 위험 요소는 `settings`가 non-optional 필드로 추가되어 기존 `RoomState` 생성 코드(테스트 픽스처 등)에서 컴파일 오류가 발생할 수 있다는 점이며, 백엔드 응답이 이미 `settings`를 포함하고 있는지 확인이 필요하다. `toLocaleString()`의 locale 의존성으로 인한 테스트 불안정 가능성도 낮은 수준으로 존재한다.

### 위험도

**LOW**