### 발견사항

- **[WARNING]** `roomId` 필드 Nullability 변경으로 인한 API 응답 계약 파손
  - 위치: `backend/src/game/game.entity.ts` — `roomId` 컬럼, `@ManyToOne` 관계
  - 상세: `roomId`가 `string`에서 `string | null`로 변경되었고, `onDelete: 'CASCADE'`에서 `SET NULL`로 변경됨. 기존에는 Room 삭제 시 관련 Game 레코드도 삭제되었으나, 이제는 `roomId = null`로 보존됨. 게임 이력이나 명예의 전당 관련 API가 `Game` 엔티티를 직렬화하여 응답할 경우, 클라이언트에게 `roomId: null`이 노출될 수 있어 기존 클라이언트 코드가 `roomId`를 항상 문자열로 가정하고 있다면 런타임 오류 발생 가능.
  - 제안: API 응답 DTO(Data Transfer Object)에서 `roomId`를 노출하는 경우 명시적으로 `string | null` 타입을 반영하고, 관련 API 문서와 클라이언트 타입 정의를 업데이트해야 함. 명예의 전당 등 조회 API의 응답 스키마에 nullable 필드임을 명확히 표기 필요.

- **[INFO]** WebSocket `game:ended` 이벤트 페이로드에 필드 추가
  - 위치: `frontend/src/hooks/useGameStore.spec.ts` — `GameEndResult` 타입 사용부
  - 상세: `GameEndResult.results` 배열의 각 항목에 `placement: number`와 `isAI: boolean` 필드가 추가됨. 필드 추가는 일반적으로 하위 호환이지만, 서버가 이 필드를 항상 포함하여 전송하도록 보장하는지 확인 필요. 기존 클라이언트 코드 중 `results` 배열 항목의 타입을 엄격하게 검증하는 로직이 있다면 영향받을 수 있음.
  - 제안: 백엔드의 `game.gateway.ts` 또는 관련 이벤트 emit 코드에서 `placement`와 `isAI`가 실제로 포함되어 전송됨을 확인. 프론트엔드 타입 정의도 동기화 필요.

- **[INFO]** `deleteByRoom` 동작 변경이 연관 API에 미치는 영향
  - 위치: `backend/src/game/game.service.ts` — `deleteByRoom` 메서드
  - 상세: 기존에는 Room에 속한 모든 Game을 삭제했으나, 이제는 `status: 'in-progress'`인 게임만 삭제. 이 메서드를 호출하는 Room 삭제/퇴장 관련 API가 있다면, 호출자 입장에서는 "방 삭제 시 게임 데이터도 사라진다"는 기존 계약이 암묵적으로 변경된 것임.
  - 제안: 이 동작 변경이 의도된 것(명예의 전당 보존 목적)임을 API 문서 또는 코드 주석에 명확히 기술 권장.

---

### 요약

이번 변경의 핵심은 AI 플레이어와 함께한 게임도 명예의 전당에 보존하기 위해 `Room` 삭제 시 `Game` 레코드를 CASCADE 삭제하지 않고 `roomId = null`로 유지하는 것이다. API 계약 관점에서 가장 주목할 부분은 `Game` 엔티티의 `roomId`가 nullable로 변경된 점으로, 이 필드를 포함하는 API 응답을 소비하는 클라이언트가 `null`을 처리하지 않으면 파손될 수 있다. 또한 `GameEndResult` 페이로드에 `placement`, `isAI` 필드가 추가되어 WebSocket 이벤트 계약이 확장되었으며, 이는 하위 호환적이나 명시적 문서화가 필요하다. 전반적으로 내부 로직의 변경이 중심이고 신규 REST 엔드포인트 추가는 없으나, `roomId` nullability 변경은 기존 API 소비자에게 실질적인 영향을 줄 수 있다.

### 위험도
**LOW**