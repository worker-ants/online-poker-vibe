### 발견사항

- **[INFO]** `GameRulesPanel.test.tsx` 테스트 커버리지는 양호하나, `formatNumber`의 로케일 의존성 미검증
  - 위치: `GameRulesPanel.test.tsx` - `renders blinds and starting chips` 테스트
  - 상세: `formatNumber`는 `toLocaleString()`을 사용하여 로케일에 따라 `1,000` 또는 `1.000` 등 다르게 출력될 수 있음. CI 환경에서 실패할 수 있는 취약한 단언
  - 제안: `expect(screen.getByText('1,000'))` 대신 로케일 독립적인 방식으로 검증하거나, `Intl` mock을 추가

- **[WARNING]** `five-card-draw` 변형에 대한 테스트 케이스 누락
  - 위치: `GameRulesPanel.test.tsx` 전체
  - 상세: `texas-holdem`, `seven-card-stud`는 테스트되지만 `five-card-draw` 변형은 다루지 않음. Ante 미표시 여부 등 변형별 동작을 검증하지 않아 회귀 가능성 존재
  - 제안: `five-card-draw` + ante 없음 케이스 추가

- **[WARNING]** `blindSchedule`이 빈 배열(`[]`)일 때 동작 미검증
  - 위치: `GameRulesPanel.tsx:20` (`showSchedule` 조건), `GameRulesPanel.test.tsx`
  - 상세: `settings.blindSchedule?.length`는 빈 배열 시 `0`(falsy)이므로 스케줄 미표시. 그러나 이 엣지 케이스에 대한 테스트가 없어 명세와 구현의 일치 여부가 문서화되지 않음
  - 제안: `blindSchedule: []`인 tournament 케이스에 대한 테스트 추가

- **[INFO]** `settings.ante`가 `0`일 때 Ante 미표시 — 의도 불명확
  - 위치: `GameRulesPanel.tsx:19` (`settings.ante != null`)
  - 상세: `ante = 0`이면 `!= null` 조건은 참이지만, ante가 0인 게임이 현실적으로 가능. 현재 테스트에 이 경계값 케이스 없음
  - 제안: `ante === 0` 케이스 테스트 추가, 또는 `ante > 0` 조건으로 명시화

- **[INFO]** `Blind Schedule` 토글 후 재닫기 동작 미검증
  - 위치: `GameRulesPanel.test.tsx` - `shows blind schedule for tournament mode`
  - 상세: 열기 동작은 테스트되나, 다시 클릭했을 때 목록이 사라지는지 검증하지 않음
  - 제안: 토글 후 `queryByText('Lv.1')`이 `null`임을 확인하는 단언 추가

- **[INFO]** 백엔드 변경 파일(`game.entity.ts`, `create-room.dto.ts`)은 import 스타일 변경(코드 포맷팅)만으로 테스트 대상 없음 — 적절함

---

### 요약

`GameRulesPanel`에 대한 테스트는 주요 케이스(변형 표시, 블라인드, Ante 조건, 토너먼트 스케줄 접기/펼치기)를 잘 커버하고 있어 전반적으로 양호하다. 다만 `toLocaleString()` 기반의 숫자 단언이 CI 환경에서 로케일 차이로 인해 불안정해질 수 있고, `five-card-draw` 변형과 `blindSchedule: []`, `ante: 0` 같은 경계값 케이스가 누락되어 있어 미래 회귀를 방지하기 위한 보완이 권장된다.

---

### 위험도

**LOW**