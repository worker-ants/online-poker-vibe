### 발견사항

- **[INFO]** `import type` 정리 (단순 코드 스타일)
  - 위치: `game.entity.ts`, `create-room.dto.ts`
  - 상세: 멀티라인 → 단일라인 정리. 컴파일 타임에만 존재하는 타입 임포트이므로 런타임 성능에 영향 없음.
  - 제안: 해당 없음.

- **[INFO]** `GameRulesPanel` 컴포넌트 — `formatNumber` 호출 시마다 `toLocaleString()` 실행
  - 위치: `GameRulesPanel.tsx` `formatNumber` 함수 + 렌더 경로
  - 상세: `toLocaleString()`은 Intl API를 내부적으로 사용하며, 매 렌더마다 locale 객체를 생성·조회합니다. 사이드바에 표시되는 숫자는 5~10개 수준으로 렌더 빈도가 낮아 실질적 영향은 미미합니다. 다만 성능에 민감한 컴포넌트라면 `Intl.NumberFormat` 인스턴스를 모듈 스코프에서 한 번만 생성하는 방식이 더 효율적입니다.
  - 제안:
    ```ts
    const fmt = new Intl.NumberFormat();
    function formatNumber(n: number): string {
      return fmt.format(n);
    }
    ```

- **[INFO]** `showSchedule` 조건식 — truthy 강제 형변환
  - 위치: `GameRulesPanel.tsx:20`
  - 상세: `settings.blindSchedule?.length`는 `number | undefined`를 반환하므로 JSX 조건부 렌더링에서 `0`이 텍스트로 렌더링될 수 있는 패턴입니다. 현재는 `{showSchedule && ...}` 형태로 사용되고 있어 `0`이 렌더링될 수 있습니다.
  - 제안: `const showSchedule = mode === 'tournament' && !!settings.blindSchedule?.length;`로 명시적 boolean 변환 권장.

- **[INFO]** `page.tsx` — `currentRoom` 조건 중복 평가
  - 위치: `page.tsx:179, 182`
  - 상세: `{currentRoom && <GameRulesPanel />}` 와 `{currentRoom && <PlayerList />}` 가 별도로 존재합니다. 두 컴포넌트 모두 `currentRoom` 의존이므로, 하나의 조건 블록으로 묶으면 조건 평가를 절반으로 줄일 수 있습니다. 현재 규모에서는 무시 가능하지만, 사이드바 컴포넌트가 늘어날수록 의미가 생깁니다.
  - 제안:
    ```tsx
    {currentRoom && (
      <>
        <GameRulesPanel room={currentRoom} />
        <PlayerList ... />
      </>
    )}
    ```

- **[INFO]** `BlindLevel[]` — 블라인드 스케줄 전체를 매 `room:updated` 이벤트마다 전송
  - 위치: `types.ts`, `RoomState.settings.blindSchedule`
  - 상세: 블라인드 스케줄은 게임 시작 후 변경되지 않는 정적 데이터입니다. 현재는 `RoomState` 전체가 매 WebSocket 이벤트마다 클라이언트에 전송되므로, 스케줄 레벨이 많을수록 불필요한 페이로드가 반복 전송됩니다. 현재 최대 플레이어 6명·소규모 스케줄 수준에서는 문제 없으나, 스케줄이 수십 레벨로 늘어날 경우 고려할 수 있습니다.
  - 제안: 정적 설정값은 초기 join 응답에만 포함하고, 이후 `room:updated` 이벤트에서는 가변 상태만 전송하는 방향으로 분리 고려.

---

### 요약

이번 변경사항은 주로 import 스타일 정리, 신규 `GameRulesPanel` UI 컴포넌트 추가, 타입 확장으로 구성되어 있습니다. 성능 관점에서 심각한 문제는 없으며, `toLocaleString()` 반복 호출과 `blindSchedule` 정적 데이터의 반복 전송이 경미한 개선 여지로 남아 있습니다. `showSchedule`의 `0` 렌더링 위험과 `currentRoom` 조건 중복 평가도 코드 명확성과 경미한 성능 측면에서 정리할 것을 권장합니다. 전반적으로 현재 규모에서 실질적인 성능 위험도는 낮습니다.

### 위험도

**LOW**