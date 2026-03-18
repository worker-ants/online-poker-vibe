## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `processAiTurnsOrNotify` 함수의 과도한 길이와 복합 책임
- 위치: `room.gateway.ts` - `processAiTurnsOrNotify` 메서드 (약 80줄)
- 상세: 이 메서드는 AI 턴 처리, draw 페이즈 분기, 액션 브로드캐스트, 핸드 완료/게임 종료 처리까지 여러 책임을 동시에 가짐. `startGame`, `handleAction`, `startNextHand` 각각에 동일한 `processAiTurnsOrNotify(roomId)` 호출 패턴이 반복됨.
- 제안: AI 액션 결정 로직과 핸드 완료 후처리를 별도 private 메서드로 추출 (`executeAiAction`, `handleHandComplete`)

---

**[WARNING]** `finishGame`과 `getGameResult`에서 결과 판정 로직 중복
- 위치: `game.service.ts` - `finishGame` (L250~270), `getGameResult` (L320~348)
- 상세: `win/loss/draw/abandoned` 결과를 판정하는 동일한 로직 블록이 두 메서드에 각각 구현되어 있음. 수정 시 두 곳을 모두 변경해야 하는 위험이 있음.
- 제안: `resolvePlayerResult(player, topChips, totalTopCount)` 등의 private 헬퍼로 추출하여 단일화

---

**[WARNING]** Hall of Fame에서 AI 필터링에 하드코딩된 문자열 패턴 사용
- 위치: `hall-of-fame.service.ts` L56, L87 (`.andWhere("gp.playerUuid NOT LIKE 'ai-%'")`)
- 상세: `ai-names.ts`에 `AI_UUID_PREFIX = 'ai-player-'`가 상수로 정의되어 있음에도, SQL 쿼리에서 `'ai-%'`로 하드코딩되어 있음. prefix 변경 시 두 파일을 별도로 수정해야 하며, 현재 `'ai-player-'`와 `'ai-%'`가 의미적으로 다름 (후자는 더 넓은 패턴).
- 제안: 상수에서 파생하거나, 코드 주석으로 의도적 광범위 패턴임을 명시

---

**[INFO]** AI UUID가 고정 인덱스(`ai-player-1`, `ai-player-2`)로 생성되어 다중 게임 충돌 가능성
- 위치: `ai-player.service.ts` - `createAiPlayers` (L27~40)
- 상세: 여러 방이 동시에 진행될 때 모든 방의 AI UUID가 `ai-player-1`로 동일해짐. 현재는 roomId 단위로 관리되므로 실제 충돌은 없지만, UUID가 식별자 역할을 하는 다른 로직 추가 시 혼동 가능.
- 제안: `ai-player-{roomId}-{n}` 또는 UUID v4 방식으로 변경 검토

---

**[INFO]** `getGameResult`가 `any` 타입 반환
- 위치: `game.service.ts` L319 (`private async getGameResult(active: ActiveGame): Promise<any>`)
- 상세: 반환 타입이 `any`로 정의되어 있어 호출부에서 타입 안정성이 없음. 기존 코드에서도 동일했으나, 변경 기회에 수정 가능했음.
- 제안: `GameResult` 인터페이스 정의 후 적용

---

**[INFO]** `scoreMap`이 함수 호출마다 재생성
- 위치: `ai-player.service.ts` - `evaluateHandStrength` 내부 scoreMap (L115~126)
- 상세: `evaluateHandStrength`는 매 AI 턴마다 호출되는데, `scoreMap` 객체가 매번 새로 생성됨.
- 제안: 클래스 레벨 readonly 상수로 추출

---

**[INFO]** `processAiTurnsOrNotify`에서 catch 없는 무한 루프
- 위치: `room.gateway.ts` - `processAiTurnsOrNotify`의 `while(true)` 루프
- 상세: `handleAction` 실패 시 예외가 전파되어 루프가 종료되지만, 오류 메시지 없이 상위 호출부로 전파됨. `startNextHand`에서만 catch가 있고, `startGame`과 `handleAction` 이벤트 핸들러에서는 없음.
- 제안: `processAiTurnsOrNotify`에 try/catch를 추가하고 오류 로깅

---

### 요약

이번 변경은 AI 플레이어 기능을 스펙에 맞게 잘 구현했으며, 코드 포맷팅 정리와 모듈 분리도 적절하다. 주요 유지보수성 위험은 두 가지다: `finishGame`/`getGameResult`의 결과 판정 로직 중복(버그 수정 시 한 곳을 놓칠 수 있음)과, `processAiTurnsOrNotify` 메서드의 과도한 책임 집중(가독성 및 테스트 어려움). `hall-of-fame.service.ts`의 AI 필터 패턴이 `ai-names.ts` 상수와 느슨하게 연결된 점도 향후 리팩터링 시 혼선을 줄 수 있다. 전반적으로 구조는 명확하나 중복 제거와 핵심 메서드 분리가 권장된다.

### 위험도

**MEDIUM**