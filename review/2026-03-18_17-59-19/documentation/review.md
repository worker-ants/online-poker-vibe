## 문서화 코드 리뷰

### 발견사항

---

**[INFO] `AiPlayerService` 공개 메서드에 JSDoc 없음**
- 위치: `backend/src/ai/ai-player.service.ts`
- 상세: `createAiPlayers`, `evaluateHandStrength`, `decideAction`, `getDiscardIndices` 등 공개 메서드가 외부에서 사용되고 있으나 파라미터와 반환값에 대한 문서가 없음. `evaluateHandStrength`는 특히 `phase`가 결과에 크게 영향을 미치나 이에 대한 설명이 없음.
- 제안: 핵심 공개 메서드에 최소한 파라미터와 반환값 설명 포함한 JSDoc 추가

---

**[INFO] `ai-names.ts`의 `AI_UUID_PREFIX` 상수와 Hall of Fame 쿼리 필터 불일치 가능성 문서화 필요**
- 위치: `backend/src/ai/ai-names.ts`, `hall-of-fame.service.ts:57, 87`
- 상세: `AI_UUID_PREFIX = 'ai-player-'`이지만 Hall of Fame 필터는 `'ai-%'`로 더 넓게 설정됨. 의도적인 방어적 설계이나 코드만 보면 불일치처럼 보임.
- 제안: 해당 쿼리 라인에 인라인 주석으로 의도 명시 (`// ai-player-* prefix 포함 모든 AI UUID 제외 (방어적 필터)`)

---

**[INFO] `getGameResult` 리팩토링에 대한 주석 불충분**
- 위치: `backend/src/game/game.service.ts:319`
- 상세: 이전에는 DB에서 조회하던 로직이 in-memory 상태 기반으로 변경됐으나, 변경 이유(AI 플레이어 포함 필요)가 주석으로 설명되지 않음. 후에 코드를 보는 개발자가 왜 DB 조회를 제거했는지 파악하기 어려울 수 있음.
- 제안: 함수 상단에 `// AI players are in-memory only, so results are built from state instead of DB` 형태의 주석 추가

---

**[INFO] `processAiTurnsOrNotify` 무한루프 위험에 대한 주석 없음**
- 위치: `backend/src/room/room.gateway.ts` - `processAiTurnsOrNotify` 메서드
- 상세: `while(true)` 루프이지만 루프 종료 조건이 `break`에만 의존함. AI 액션이 게임 상태를 진전시키지 못하는 엣지케이스에서 무한루프 위험이 있음에도 이에 대한 설명 없음.
- 제안: 루프 진입 시 주석으로 종료 조건 명시 (`// Runs until human player's turn or game ends`)

---

**[WARNING] 스펙 문서(`spec/10-ai-player.md`)와 실제 구현 간 차이**
- 위치: `spec/10-ai-player.md` - "핸드 강도 평가" 섹션
- 상세: 스펙에는 `AKs=0.85, KQs=0.75` 등 구체적인 수치가 기술되어 있으나, 실제 구현(`preFlopStrength`)은 공식 기반 계산이며 이 수치들이 정확히 매칭되지 않음. 스펙이 구현을 정확히 반영하지 않아 유지보수 시 혼동 가능.
- 제안: 스펙의 예시 수치를 실제 공식으로 교체하거나, "참고용 근사치" 표기 추가

---

**[INFO] `checkAllReady` 동작 변경에 대한 주석 없음**
- 위치: `backend/src/room/room.service.ts:276`
- 상세: `< 2`에서 `< 1`로 변경된 것이 AI 플레이어 도입에 의한 의도적 변경이나, 코드에 설명이 없어 버그처럼 보일 수 있음.
- 제안: `// AI players fill remaining seats, so 1 human player is sufficient` 주석 추가

---

**[INFO] `history/history.md` 요구사항은 잘 기록되었으나 AI 플레이어 제한사항 누락**
- 위치: `history/history.md` - Turn 6 섹션
- 상세: AI 이름이 6개(Alice~Frank)로 고정되어 있어 6명 초과 AI 생성 시 이름이 반복되는 제한이 있으나, 이에 대한 언급 없음.
- 제안: 스펙이나 히스토리에 `maxPlayers <= 6` 설계 전제 명시 (현재 방 최대 인원이 6명이므로 실용적 문제는 없으나)

---

### 요약

전체적으로 스펙 문서(`spec/10-ai-player.md`)가 잘 작성되어 있고 기능 요구사항을 명확히 설명하고 있어 문서화 수준은 양호합니다. 다만, 실제 코드와 스펙 간의 세부 수치 불일치, 복잡한 로직(무한루프 종료 조건, DB→메모리 전환 이유, `checkAllReady` 임계값 변경)에 대한 인라인 주석 부재, Hall of Fame 쿼리의 방어적 필터 의도 미명시 등 유지보수성을 저해할 수 있는 소소한 문서화 누락이 있습니다. `AiPlayerService`의 공개 API에 JSDoc이 없는 점도 아쉬우나, 테스트 코드가 문서 역할을 어느 정도 대체하고 있습니다.

### 위험도

**LOW**