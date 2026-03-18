### 발견사항

- **[INFO]** import 구문 스타일 정리 (multi-line → single-line)
  - 위치: `game.entity.ts`, `create-room.dto.ts`
  - 상세: 외부 패키지 추가 없음. 기존 `../common/types` 내부 타입 import를 단순히 한 줄로 축약한 변경. 의존성 관계는 동일하게 유지됨.
  - 제안: 문제 없음.

- **[INFO]** `GameRulesPanel` 컴포넌트 추가 — 신규 외부 의존성 없음
  - 위치: `GameRulesPanel.tsx`
  - 상세: `useState` (React), `RoomState`/`VARIANT_LABELS`/`MODE_LABELS` (내부 `types.ts`)만 사용. 신규 패키지 없음.
  - 제안: 문제 없음.

- **[INFO]** `GameRulesPanel.test.tsx` — 테스트 의존성 확인
  - 위치: `GameRulesPanel.test.tsx`
  - 상세: `@testing-library/react`, `@testing-library/user-event`, `vitest` 사용. 모두 기존 테스트 파일에서 이미 사용 중인 의존성으로 신규 추가 없음.
  - 제안: 문제 없음.

- **[INFO]** `RoomState`에 `settings: RoomSettings` 필드 추가
  - 위치: `frontend/src/lib/types.ts`
  - 상세: 순수 타입 정의 변경으로 런타임 의존성 영향 없음. 단, 백엔드 `room.gateway.ts` / `room.service.ts`가 `settings`를 `RoomState` 응답에 실제로 포함하는지 확인 필요. 프론트엔드 타입은 추가됐지만 백엔드가 해당 필드를 누락하면 런타임에 `settings` 접근 시 `undefined` 오류 발생 가능.
  - 제안: 백엔드 `getRoomState()` 반환값에 `settings` 필드가 포함되어 있는지 확인. `GameRulesPanel`에서 `settings.smallBlind` 등을 직접 접근하므로 null-guard 또는 optional chaining 검토 권장.

- **[WARNING]** `settings.ante!` non-null assertion 사용
  - 위치: `GameRulesPanel.tsx:31`
  - 상세: `showAnte` 조건으로 `settings.ante != null`을 확인한 후 `settings.ante!`를 사용하는 패턴은 논리적으로 안전하나, TypeScript narrowing이 직접 적용되지 않아 `!` 단언이 필요한 구조. 내부 의존성(타입 정의) 측면에서 `RoomSettings.ante`가 `optional`이기 때문에 발생하는 구조적 문제.
  - 제안: `showAnte && settings.ante != null` 조건을 활용하거나, 변수에 미리 할당하여 narrowing 처리 권장: `const ante = settings.ante; showAnte && ante != null && <Row ... value={formatNumber(ante)} />`

- **[INFO]** `settings.blindSchedule!` non-null assertion 사용
  - 위치: `GameRulesPanel.tsx:51`
  - 상세: `showSchedule` 조건이 truthy일 때 `blindSchedule`가 존재함이 보장되므로 논리적으로 안전하나, `ante`와 동일한 narrowing 이슈.
  - 제안: `settings.blindSchedule ?? []` 로 방어적 처리 가능.

---

### 요약

이번 변경은 신규 외부 패키지를 일절 추가하지 않았으며, 기존 내부 타입(`types.ts`)과 이미 설치된 테스트 라이브러리만 활용한 순수 기능 추가다. 의존성 관점에서 위험 요소는 없으나, `RoomState.settings` 필드가 백엔드 응답에 실제로 포함되는지에 대한 **런타임 계약(contract) 검증**이 누락된 점과, `settings.ante!` / `settings.blindSchedule!` non-null assertion으로 인한 잠재적 타입 안전성 약화가 소소한 개선 포인트로 존재한다.

### 위험도

**LOW**