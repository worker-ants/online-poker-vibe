## 발견사항

### **[INFO]** 핵심 기능 구현 파일 - 범위 적합
- 위치: `GameRulesPanel.tsx`, `GameRulesPanel.test.tsx`, `HelpModal.tsx`, `TopNav.tsx`
- 상세: 커밋 메시지 "게임 화면에 룰 표기 추가"의 직접 구현체. `GameRulesPanel`(게임 설정/룰 표시), `HelpModal`(핸드 랭킹 + 베팅 설명), `TopNav`(도움말 버튼 연결)은 요청 범위에 정확히 부합.

### **[INFO]** 지원 UI 컴포넌트 - 범위 적합
- 위치: `Modal.tsx`, `Button.tsx`, `Button.spec.tsx`, `Card.spec.tsx`
- 상세: `HelpModal`의 기반이 되는 `Modal`, `Button`은 신규 기능을 위해 필요한 지원 컴포넌트이며 범위 내.

### **[WARNING]** 블라인드 스케줄 접이식 UI - 경미한 과잉 구현
- 위치: `GameRulesPanel.tsx:37-62`
- 상세: 토너먼트 블라인드 스케줄을 접고/펼 수 있는 `scheduleOpen` 상태 및 클릭 핸들러 구현. "룰 표기 추가"의 범위에서 단순 표시로도 충분했으나, 접이식 UI가 추가됨.
- 제안: 기능 자체는 유효하고 UX에 긍정적이므로 MINOR 수준. 별도 티켓으로 분리할 필요는 없음.

### **[WARNING]** 백엔드 엔진 파일 다수 포함 - 범위 불일치 가능성
- 위치: `ai-player.service.ts`, `ai-player.service.spec.ts`, `betting-round.ts`, `betting-round.spec.ts`, `deck.ts`, `deck.spec.ts`, `app.module.ts`, `database.module.ts`, `guards/`, `decorators/`
- 상세: 이 파일들은 "게임 화면에 룰 표기 추가"와 직접적 관련이 없는 백엔드 게임 엔진 및 인프라 파일. 이전 Turn에서 구현된 것으로 보이며, 이번 Turn에서 수정된 흔적이 없다면 리뷰 범위에 포함될 필요가 없음.
- 제안: 해당 파일들이 Turn 13에서 실제로 수정되었는지 git diff로 확인 필요. 수정되지 않았다면 이번 리뷰 제출에서 제외 권장.

### **[WARNING]** 로비·명예의 전당 컴포넌트 포함 - 범위 불일치 가능성
- 위치: `CreateRoomModal.tsx`, `NicknameInput.tsx`, `RoomCard.tsx`, `RoomList.tsx`, `PlayerHistoryModal.tsx`, `RankingsTable.tsx`
- 상세: 게임 화면 룰 표기와 무관한 로비 및 명예의 전당 컴포넌트. 이전 Turn 구현물로 보임.
- 제안: 위 백엔드 파일과 동일하게 실제 변경 여부를 확인하여 범위를 명확히 할 것.

### **[INFO]** `types.ts` - 범위 적합
- 위치: `types.ts:VARIANT_LABELS`, `MODE_LABELS`, `BlindLevel`, `RoomSettings`
- 상세: `GameRulesPanel`과 `HelpModal`에서 직접 사용되는 `VARIANT_LABELS`, `MODE_LABELS`, `BlindLevel`, `RoomSettings` 타입/상수 추가는 구현에 필요한 정당한 변경.

### **[INFO]** `useGameStore`, `useRoomList`, `socket.ts`, `constants.ts` - 이전 Turn 산물
- 위치: 해당 파일들
- 상세: 게임 상태 관리 인프라로, Turn 13 기능과 직접 연관은 없으나 전체 게임 동작에 필요한 기반. 수정이 없었다면 리뷰 포함 불필요.

---

## 요약

Turn 13의 핵심 구현물인 `GameRulesPanel`, `HelpModal`, `TopNav` 수정은 "게임 화면에 룰 표기 추가"라는 요청 범위에 정확히 부합하며, 블라인드 스케줄 접이식 UI 정도의 경미한 과잉 구현 외에 범위 일탈은 없다. 다만, 이번 리뷰에 포함된 50개 파일 중 백엔드 엔진(AI, 베팅, 덱), 로비 컴포넌트, 명예의 전당, 인프라 파일 등 상당수가 이전 Turn의 기존 코드로 보이며, 이들이 Turn 13에서 실제로 수정되지 않았다면 이번 범위 리뷰 제출에서 제외하는 것이 더 명확한 범위 관리가 된다.

## 위험도

**LOW**