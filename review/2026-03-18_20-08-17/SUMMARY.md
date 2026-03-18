# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - `RoomState.settings` 필드의 백엔드 계약 미검증으로 런타임 오류 가능성 존재

## Critical 발견사항

없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `RoomState.settings`가 non-optional 필수 필드로 추가되었으나, 백엔드 WebSocket 응답에 실제로 포함되는지 검증 없음. `room:updated` / `room:join` 이벤트에서 `settings` 누락 시 런타임 TypeError 발생 가능 | `frontend/src/lib/types.ts:42` | 백엔드 `getRoomState()` 응답 확인 후 필드 추가, 또는 `settings?: RoomSettings`로 optional 처리 후 컴포넌트 방어 코드 추가 |
| 2 | 보안/유효성 | `CreateRoomDto.settings` 내부 필드(`startingChips`, `smallBlind`, `bigBlind`, `blindSchedule` 등)에 세부 유효성 검증 없음. 음수 칩, 0 블라인드, 비대한 배열 전송 가능 | `create-room.dto.ts:25` | `RoomSettingsDto` 분리 후 `@Min`, `@Max`, `@IsInt`, `@ArrayMaxSize` 적용, `@ValidateNested()` + `@Type(() => RoomSettingsDto)` 추가 |
| 3 | 테스트 | `five-card-draw` 변형 테스트 케이스 누락 — Ante 미표시 등 변형별 동작 회귀 가능성 | `GameRulesPanel.test.tsx` | `five-card-draw` + ante 없음 케이스 테스트 추가 |
| 4 | 테스트 | `blindSchedule: []` 빈 배열 케이스 테스트 미포함 — 토너먼트 모드에서 빈 스케줄 시 미표시 동작 문서화 필요 | `GameRulesPanel.test.tsx`, `GameRulesPanel.tsx:20` | `blindSchedule: []`인 tournament 케이스 테스트 추가 |
| 5 | 아키텍처 | `RoomSettings` / `BlindLevel` 타입이 프론트엔드에만 정의되어 백엔드 `common/types`와 diverge 가능성 | `frontend/src/lib/types.ts:139-147` | 장기적으로 공유 타입 패키지(`packages/shared-types`) 도입 또는 OpenAPI 기반 자동 생성 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입 안전성 | `showSchedule` 변수가 `number \| undefined \| false` 타입 반환 — `0`이 falsy로 평가되며 TypeScript strict 환경에서 의미 불명확 | `GameRulesPanel.tsx:20` | `const showSchedule = mode === 'tournament' && (settings.blindSchedule?.length ?? 0) > 0;` 또는 `!!settings.blindSchedule?.length` |
| 2 | 타입 안전성 | `settings.ante!`, `settings.blindSchedule!` non-null assertion 사용 — 조건으로 안전하나 리팩토링 시 버그 가능성 | `GameRulesPanel.tsx:28, 45` | optional chaining + 기본값 패턴 또는 변수 할당으로 타입 narrowing 처리 |
| 3 | 테스트 안정성 | `formatNumber`의 `toLocaleString()` 로케일 의존성으로 CI 환경에서 테스트 실패 가능(`1,000` vs `1000`) | `GameRulesPanel.test.tsx` | `toLocaleString('en-US')` locale 명시 또는 `vi.stubGlobal`로 `Intl` mock 처리 |
| 4 | 아키텍처 | `GameRulesPanel`이 `RoomState` 전체를 prop으로 수신하나 실제 사용은 `variant`, `mode`, `settings` 3개 필드뿐 — ISP 위반, 불필요한 리렌더 가능 | `GameRulesPanel.tsx:10` | `variant`, `mode`, `settings`만 개별 prop으로 수신하도록 인터페이스 분리 |
| 5 | 아키텍처 | `VARIANT_LABELS`, `MODE_LABELS` 런타임 상수가 타입 정의 파일(`types.ts`)에 혼재 | `frontend/src/lib/types.ts` | 상수를 `constants.ts`로 분리하여 타입 파일 역할 명확화 |
| 6 | 성능 | `formatNumber` 호출마다 `toLocaleString()` 실행 — Intl 객체 반복 생성 | `GameRulesPanel.tsx` | `const fmt = new Intl.NumberFormat(); fmt.format(n)` 모듈 스코프 인스턴스 사용 |
| 7 | 유지보수 | UI 라벨 한국어/영어 혼용 (`게임 종류` vs `Blinds`, `Ante`) — 일관성 기준 불명확 | `GameRulesPanel.tsx:23-28` | 포커 전문 용어는 영어, 나머지는 한국어 통일 기준 수립 |
| 8 | 데이터베이스 | `game.entity.ts`의 `roomId` FK 컬럼에 `@Index()` 없음 (기존 이슈) | `game.entity.ts:22` | `@Index()` 데코레이터 추가 |
| 9 | 테스트 | `ante === 0` 경계값 케이스 테스트 미포함 | `GameRulesPanel.tsx:19`, `GameRulesPanel.test.tsx` | `ante: 0` 케이스 테스트 추가 또는 `ante > 0` 조건 명시화 |
| 10 | 테스트 | 블라인드 스케줄 토글 후 재닫기 동작 미검증 | `GameRulesPanel.test.tsx` | 재클릭 후 `queryByText('Lv.1')` null 확인 단언 추가 |
| 11 | 문서 | `spec/game-rules-display.md` 하단 "변경 파일" 섹션이 구현 메모 성격 — 스펙 문서 지속성 저하 | `spec/game-rules-display.md` | "변경 파일" 섹션 제거 또는 경량화 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | `RoomState.settings` non-optional 필드, 백엔드 응답 미검증 |
| api_contract | MEDIUM | 백엔드 계약 검증 없이 프론트엔드 타입만 변경 |
| security | LOW | `CreateRoomDto.settings` 내부 유효성 검증 부재 |
| dependency | LOW | non-null assertion 타입 안전성, 백엔드 응답 계약 미확인 |
| testing | LOW | `five-card-draw` 케이스 및 경계값 테스트 누락, 로케일 의존성 |
| performance | LOW | `toLocaleString` 반복 호출, `showSchedule` boolean 변환 필요 |
| side_effect | LOW | `RoomState.settings` non-optional 추가로 기존 픽스처 영향, `toLocaleString` CI 불안정 |
| architecture | LOW | 타입 중복 정의, ISP 위반, 상수/타입 파일 혼재 |
| maintainability | LOW | non-null assertion, `showSchedule` 타입 불명확, 한/영 라벨 혼용 |
| database | LOW | `roomId` FK 인덱스 누락 (기존 이슈) |
| documentation | LOW | JSDoc 미비, README 업데이트 여부, 스펙 문서 구현 메모 혼재 |
| scope | LOW | 백엔드 import 정리가 기능 커밋에 혼입 |
| concurrency | NONE | 해당 없음 |

## 발견 없는 에이전트

- **concurrency** — 동시성 관련 변경 없음, React 함수형 업데이트 패턴 올바르게 사용됨

## 권장 조치사항

1. **[필수] 백엔드 `getRoomState()` 응답에 `settings` 포함 여부 확인** — `room.gateway.ts` / `room.service.ts`를 직접 검토하여 `settings: RoomSettings`가 WebSocket 응답에 포함됨을 코드로 검증. 미포함 시 백엔드 추가 또는 프론트엔드 `settings?: RoomSettings` optional 처리
2. **[권장] `showSchedule` boolean 명시적 변환** — `!!settings.blindSchedule?.length` 또는 `(settings.blindSchedule?.length ?? 0) > 0`으로 타입 명확화
3. **[권장] non-null assertion 제거** — `settings.ante` / `settings.blindSchedule` 접근 시 optional chaining + nullish coalescing으로 대체
4. **[권장] 테스트 보완** — `five-card-draw` 변형, `blindSchedule: []`, `ante: 0` 경계값, 토글 재닫기 케이스 추가
5. **[권장] `formatNumber` 로케일 고정** — `toLocaleString('en-US')` 명시 또는 CI 환경 locale 고정으로 테스트 안정성 확보
6. **[선택] `CreateRoomDto.settings` 세부 유효성 검증** — `RoomSettingsDto` 분리 및 `@ValidateNested()` 적용
7. **[선택] `GameRulesPanel` props 인터페이스 분리** — `RoomState` 전체 대신 필요한 3개 필드만 수신
8. **[선택] `roomId` FK 인덱스 추가** — `game.entity.ts`에 `@Index()` 데코레이터 추가