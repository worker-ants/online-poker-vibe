### 발견사항

- **[WARNING]** `RoomSettings` 타입의 `settings` 필드가 `RoomState`에 non-optional로 추가되었으나, 기존 백엔드 응답에 `settings`가 누락될 경우 런타임 오류 발생 가능
  - 위치: `frontend/src/lib/types.ts:39`
  - 상세: `settings: RoomSettings`로 필수 필드로 정의되어 있으나, 백엔드 `getRoomState()`가 실제로 `settings`를 포함하여 응답하는지 검증되지 않음. 기존 WS 이벤트(`room:updated`) 핸들러도 동일한 영향을 받음
  - 제안: 백엔드 `RoomState` 응답 타입을 확인하거나, 프론트엔드에서 `settings?: RoomSettings`로 optional 처리 후 `GameRulesPanel`에서 방어 로직 추가

- **[WARNING]** `Five Card Draw` 변형에서 Blinds 항목 표시가 의미상 부정확할 수 있음
  - 위치: `GameRulesPanel.tsx` — `Row label="Blinds"` 항상 표시
  - 상세: Five Card Draw는 Ante 기반 게임으로 Small/Big Blind 개념이 없거나 다르게 적용될 수 있음. 스펙의 표시 정보 테이블에는 Blinds가 "항상" 표시로 정의되어 있으나, 변형별 적용 차이를 고려하지 않음
  - 제안: 스펙에서 Five Card Draw의 블라인드 정책을 명확히 정의하거나, 변형별 조건부 표시 검토

- **[INFO]** `showSchedule` 조건에서 `settings.blindSchedule?.length`가 숫자(0 제외)로 truthy 평가되므로 빈 배열(`[]`) 입력 시 섹션 미표시 — 의도된 동작이나 테스트 미포함
  - 위치: `GameRulesPanel.tsx:21`
  - 상세: 토너먼트 모드인데 `blindSchedule: []`인 경우 스케줄 섹션이 표시되지 않음. 스펙 요구사항에는 이 엣지 케이스가 정의되어 있지 않음
  - 제안: 테스트에 `blindSchedule: []` 케이스 추가하여 동작 명시화

- **[INFO]** 스펙 문서(`spec/game-rules-display.md`)에 "백엔드 `getRoomState()`는 이미 `settings: RoomSettings`를 응답에 포함"으로 기술되어 있으나, 실제 백엔드 검증 없이 프론트엔드 타입만 변경됨
  - 위치: `spec/game-rules-display.md` — 데이터 흐름 1번
  - 상세: 백엔드 entity(`game.entity.ts`, `create-room.dto.ts`) 변경사항은 import 단축뿐이며, `settings` 필드가 WS 응답에 포함되는지 별도 검증 없음
  - 제안: 백엔드 Room WS 응답에 `settings` 포함 여부를 확인하는 통합 테스트 또는 코드 검증 필요

---

### 요약

이번 변경은 요구사항(게임 룰 우측 사이드바 표시)을 전반적으로 충실히 구현하였으며, TDD 원칙에 따라 테스트가 선행 작성되었고 스펙 문서도 함께 정비되었습니다. 다만 핵심 위험 요소는 `RoomState.settings`가 non-optional로 정의되어 있음에도 백엔드 WS 응답에 `settings`가 실제로 포함되는지 코드 레벨에서 검증되지 않아, 기존 `room:updated` 이벤트 수신 시 런타임 오류가 발생할 가능성이 있습니다. 또한 Five Card Draw 변형에서의 Blinds 표시 적합성은 스펙 명확화가 필요합니다.

---

### 위험도

**MEDIUM**