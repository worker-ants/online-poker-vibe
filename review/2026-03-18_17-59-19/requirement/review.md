## 요구사항 리뷰 결과

### 발견사항

---

#### **[CRITICAL]** `processAiTurnsOrNotify` 에러 처리 부재
- **위치:** `room.gateway.ts` - `processAiTurnsOrNotify` 메서드
- **상세:** `handleAction` 호출 중 예외 발생 시 (예: 잘못된 액션, DB 오류) 함수가 unhandled exception으로 종료됨. `startNextHand`는 `catch { // Game may have ended }`로 보호되어 있지만, 게임 시작 직후나 다른 경로에서 호출되는 경우는 보호되지 않음. AI 턴 처리 실패 시 게임이 영구적으로 중단되고 인간 플레이어에게 아무 이벤트도 전달되지 않음.
- **제안:**
  ```typescript
  private async processAiTurnsOrNotify(roomId: string) {
    try {
      while (true) {
        // ...기존 로직
      }
    } catch (err) {
      // 게임 상태 복구 또는 클라이언트에 에러 알림
      this.server.to(roomId).emit('error', { message: 'AI 처리 중 오류 발생' });
    }
  }
  ```

---

#### **[WARNING]** `hall-of-fame.service.ts` 에서 `game` null 체크 제거 후 안전하지 않은 접근
- **위치:** `hall-of-fame.service.ts:157` - `const game = participation.game;` 이후 `game.id` 접근
- **상세:** `game!`에서 `game`으로 변경되었으나 바로 다음 줄에서 `participantsByGame.get(game.id)`로 null 체크 없이 접근함. `validParticipations` 필터가 `p.game &&`로 보호하지만 TypeScript 타입 시스템은 이를 추적하지 못함. 런타임보다 타입 안전성 문제.
- **제안:** `if (!game) continue;` guard 추가 또는 `game?.id` 옵셔널 체이닝 사용

---

#### **[WARNING]** `getGameResult`와 `finishGame` 결과 계산 로직 중복
- **위치:** `game.service.ts:249-300` (finishGame), `319-355` (getGameResult)
- **상세:** 플레이어 정렬, 상위 칩 계산, win/loss/draw/abandoned 판정 로직이 두 함수에 동일하게 구현됨. 향후 로직 변경 시 한 곳만 수정하면 불일치 발생 가능. 스펙 요구사항의 "게임 결과" 정의가 두 경로에서 다르게 동작할 위험이 있음.
- **제안:** 결과 계산 로직을 별도 private 메서드로 분리

---

#### **[WARNING]** AI 플레이어 UUID 고정값 - 다중 게임 시나리오
- **위치:** `ai-player.service.ts:27` - `uuid: \`${AI_UUID_PREFIX}${i + 1}\``
- **상세:** AI UUID가 `ai-player-1`, `ai-player-2` 등 고정값으로 생성됨. 하나의 방에서 연속 게임 진행 시 `aiPlayersMap`은 새 게임 시작 전에 덮어씌워지지 않을 수 있음. 스펙은 "인메모리 전용"으로 명시하고 있어 의도된 설계이지만, `aiPlayersMap`이 게임 종료 시에만 `delete`되고, 게임 종료 전 재시작 케이스에 대한 처리가 없음.
- **제안:** 게임 시작 시 기존 aiPlayersMap 항목을 덮어씌우는 현재 동작이 올바른지 명시적 주석 추가

---

#### **[WARNING]** 스펙의 프리플롭 강도 수치와 구현 불일치
- **위치:** `ai-player.service.ts:preFlopStrength()`, `spec/10-ai-player.md`
- **상세:** 스펙에 "AKs=0.85, KQs=0.75, AKo=0.75, KQo=0.65"로 명시되어 있으나 실제 구현은 수식 기반으로 계산. AK suited 실제 계산값: `(14+13-4)/24 + 0.05 + 0.05 + 0.15 ≈ 0.98`로 스펙의 0.85와 차이가 있음. 기능적으로는 합리적이지만 스펙과 구현 간 명시적 괴리가 존재.
- **제안:** 스펙 수치를 구현에 맞게 업데이트하거나, 스펙에 "수식 기반 근사값 사용"으로 명시

---

#### **[INFO]** `getDiscardIndices` - Full House 드로우 최적화 미지원
- **위치:** `ai-player.service.ts:getDiscardIndices()`
- **상세:** 페어(예: AA)가 있을 때 트립스/풀하우스 드로우를 위해 킥커를 유지하는 전략이 없음. 현재는 페어만 유지하고 3장 버림. 스펙에 "페어/트립스/쿼드 유지"로만 명시되어 있어 스펙 충족은 하지만, 최적 전략과 차이.
- **제안:** 현재 스펙 범위 내에서는 허용 가능

---

#### **[INFO]** `checkAllReady` 최소 인원 1명 변경 - 호스트 자동 시작 엣지 케이스
- **위치:** `room.service.ts:275`
- **상세:** 방장이 혼자 준비 완료 시 즉시 게임이 시작됨. 스펙 요구사항에 부합하지만, 방장이 실수로 ready 토글 시 의도치 않게 AI와 게임이 시작될 수 있음. 사용자 경험 관점의 문제이나 요구사항에는 부합.

---

### 요약

AI 플레이어 기능은 스펙 요구사항(서버사이드 동작, 홀카드 비공개, 랭킹 제외, delay 없는 즉시 액션)을 전반적으로 충실히 구현하고 있으며, 게임 흐름 통합, 프론트엔드 배지 표시, Three Variants 지원이 모두 포함되어 있다. 그러나 `processAiTurnsOrNotify` 함수의 에러 처리 부재가 주요 위험 요소로, AI 턴 처리 중 예외 발생 시 게임이 복구 불가능한 상태로 중단될 수 있다. 또한 `getGameResult`와 `finishGame`의 결과 계산 로직 중복은 향후 스펙 변경 시 불일치를 야기할 수 있다. 스펙 문서의 프리플롭 강도 수치와 실제 구현 값이 다른 점도 문서 일관성 측면에서 조치가 필요하다.

### 위험도

**MEDIUM**