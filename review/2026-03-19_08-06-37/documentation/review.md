## 문서화 코드 리뷰

### 발견사항

---

**[INFO]** `game.entity.ts` — `roomId` nullable 변경에 대한 설명 부재
- 위치: `game.entity.ts:20-21`
- 상세: `roomId`가 `nullable: true`, `string | null`로 변경되었고 `onDelete: 'CASCADE'` → `'SET NULL'`로 바뀌었으나, 이 변경의 비즈니스 의도(방 삭제 후 게임 이력 보존)를 설명하는 주석이 없음
- 제안: 
  ```ts
  // Room 삭제 시 게임 기록은 명예의 전당 보존을 위해 유지 (SET NULL)
  @Column({ type: 'text', nullable: true })
  roomId: string | null;
  ```

---

**[INFO]** `game.service.ts` — `deleteByRoom` 인라인 주석은 양호하나 메서드 시그니처 문서 없음
- 위치: `game.service.ts:376`
- 상세: `// Only delete in-progress games; completed/abandoned games are preserved for Hall of Fame` 주석은 적절하나, public 메서드임에도 JSDoc이 없어 의도와 부수효과를 파악하기 위해 구현을 읽어야 함
- 제안:
  ```ts
  /**
   * 방과 연관된 진행 중(in-progress) 게임만 삭제합니다.
   * completed/abandoned 게임은 명예의 전당 기록 보존을 위해 유지됩니다.
   */
  async deleteByRoom(roomId: string): Promise<void>
  ```

---

**[INFO]** `game.service.spec.ts` — 테스트 설명이 의도를 충분히 전달하지 않음
- 위치: `game.service.spec.ts:271` (`'should only delete in-progress games, preserving completed games'`)
- 상세: 테스트 제목은 적절하나, 두 번째 테스트(`'should not delete any records when only completed games exist'`)는 "completed games만 있을 때"라고 기술하지만 실제로 `find`의 반환값이 빈 배열이므로 "진행 중인 게임이 없을 때"가 더 정확한 설명임
- 제안: `'should skip deletion when no in-progress games are found'`

---

**[INFO]** `CLAUDE.md` — TEST WORKFLOW의 `other tests` 항목이 불명확
- 위치: `CLAUDE.md` TEST WORKFLOW 섹션
- 상세: `3. other tests` 항목이 구체적으로 어떤 테스트를 의미하는지(e2e, integration 등) 명시되어 있지 않아 독자가 판단해야 함
- 제안: `3. other tests (e2e, integration 등)`으로 구체화

---

**[INFO]** `useGameStore.spec.ts` — 타입 필드 추가(`placement`, `isAI`)에 대한 변경 이유가 테스트 코드에서 불투명
- 위치: `useGameStore.spec.ts:87-88`
- 상세: `placement`와 `isAI` 필드가 추가되었지만 왜 기존 테스트 데이터가 불완전했는지 설명하는 주석이 없음. 타입 변경에 의한 수정임을 명시하면 향후 유지보수에 도움이 됨
- 제안: 필수는 아니나 `GameEndResult` 타입 정의 변경 이력을 spec 문서에 반영 여부 검토

---

### 요약

이번 변경사항은 방 삭제 시 게임 이력을 명예의 전당 보존 목적으로 유지하는 중요한 비즈니스 로직 변경을 포함하고 있으나, 문서화 측면에서 전반적으로 양호한 편입니다. `game.service.ts`의 인라인 주석은 의도를 잘 설명하고 있으며, `CLAUDE.md` 워크플로우 개선도 명확합니다. 다만 public 메서드 JSDoc 부재, 테스트 케이스 명칭의 정확성, `other tests` 항목의 모호함 등 소규모 개선 여지가 있습니다. spec 문서(`spec/08-hall-of-fame.md` 등)에 AI 게임 제외 정책이 명시되어 있는지 확인이 필요합니다.

### 위험도

**LOW**