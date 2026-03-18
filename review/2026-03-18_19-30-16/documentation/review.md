## 문서화 코드 리뷰

### 발견사항

---

**[INFO] `onDelete: 'CASCADE'` 추가에 대한 인라인 주석 부재**
- 위치: `game-participant.entity.ts:37, 42` / `game.entity.ts:42`
- 상세: `onDelete: 'CASCADE'` 옵션은 데이터 무결성에 중요한 영향을 미치는 설정이지만, 왜 CASCADE를 선택했는지에 대한 설명이 없음. 특히 `Player`가 삭제될 때 `GameParticipant`도 함께 삭제되는 동작은 비즈니스 임팩트가 큰 결정임
- 제안:
  ```ts
  // Room 삭제 시 관련 게임 기록도 함께 삭제 (고아 레코드 방지)
  @ManyToOne(() => Game, (game) => game.participants, { onDelete: 'CASCADE' })
  ```

---

**[WARNING] `leaveRoom` 내 게임 레코드 삭제 로직에 주석 보완 필요**
- 위치: `room.service.ts:183-195`
- 상세: 기존 주석은 `"If no players left, delete room and associated game records"`로 변경되었으나, 직접 DELETE 쿼리를 사용하는 이유(CASCADE가 있음에도 명시적 삭제를 하는 이유)에 대한 설명이 없음. SQLite에서 FK CASCADE가 기본 비활성화되어 있어 수동 삭제가 필요한 맥락이 문서화되어 있지 않음
- 제안:
  ```ts
  // SQLite는 PRAGMA foreign_keys=ON이 필요하므로, 명시적으로 관련 레코드를 삭제
  // Room 삭제 전 GameParticipant → Game → Room 순서로 정리
  const games = await this.gameRepository.find({ where: { roomId } });
  ```

---

**[INFO] `RoomModule`에 `Game`, `GameParticipant` 추가 이유 미기재**
- 위치: `room.module.ts:16`
- 상세: `RoomModule`이 `GameModule`과 순환 의존성(`forwardRef`)을 가지면서도 별도로 Game 엔티티를 직접 import하는 구조적 이유가 명확하지 않음. 이 패턴이 의도적인 설계인지 알기 어려움
- 제안: 모듈 상단에 짧은 주석으로 이유 명시
  ```ts
  // leaveRoom 시 Room 삭제와 함께 관련 Game/GameParticipant를 정리하기 위해 직접 의존
  TypeOrmModule.forFeature([Room, RoomPlayer, Game, GameParticipant]),
  ```

---

**[INFO] `mockParticipantRepository` — 테스트용 mock의 메서드 체이닝 구조에 주석 없음**
- 위치: `room.service.spec.ts:46-53`
- 상세: `createQueryBuilder` mock이 복잡한 체이닝 구조(`.delete().where().execute()`)를 구현하고 있으나, 이것이 실제 서비스의 어떤 쿼리를 모킹하는지 명시되지 않음. 유지보수 시 혼란 가능
- 제안:
  ```ts
  // RoomService.leaveRoom의 GameParticipant 직접 삭제 쿼리를 모킹
  const mockParticipantRepository = {
    createQueryBuilder: jest.fn(() => ({ ... })),
  };
  ```

---

**[INFO] `Card.tsx` 색상 변경에 대한 주석/문서 부재**
- 위치: `frontend/src/components/cards/Card.tsx:22-23`
- 상세: `clubs`, `spades`의 색상이 `text-white` → `text-gray-900`으로 변경되었으나, 이 변경이 가시성(흰 배경의 카드에서 흰 글자가 보이지 않던 버그 수정)임을 나타내는 주석이나 히스토리가 없음. `history.md`의 Turn 11 버그 설명과 연결되어야 함
- 제안: 간단한 인라인 주석
  ```ts
  // 카드 배경(white)에서 가시성 확보를 위해 dark 색상 사용
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
  ```

---

**[INFO] `history.md` Turn 11 — 버그 원인 설명 누락**
- 위치: `history/history.md:516-516`
- 상세: Turn 11의 문제 설명만 기재되어 있고, 수행된 조치 내용이 기록되지 않음. history.md의 다른 turn들도 조치 내용이 생략된 경우가 있으나 이번 변경에서도 동일한 패턴이 반복됨
- 제안: 조치 완료 후 간략한 원인/해결 방법을 Turn 11 하단에 추가

---

### 요약

이번 변경은 외래 키 CASCADE 설정과 명시적 게임 레코드 삭제 로직, 카드 색상 버그 수정을 포함하는 실용적인 수정이다. 코드 자체는 기능적으로 올바르나, **왜** CASCADE를 선택했고 **왜** SQLite 환경에서 명시적 삭제가 필요한지에 대한 문서가 전무하여 향후 유지보수 시 의도를 파악하기 어렵다. 특히 `RoomModule`이 `GameModule`과 순환 의존성을 유지하면서도 직접 Game 엔티티를 등록하는 구조적 이유, 그리고 카드 색상 변경이 버그 수정임을 알 수 있는 단서가 코드 어디에도 남아있지 않다. 전반적으로 주석이 필요한 곳에 부재하며, `history.md`의 조치 내용 기록도 지속적으로 생략되고 있다.

### 위험도

**LOW** — 기능적 문제는 없으나, 설계 의도가 문서화되지 않아 향후 유지보수 시 잘못된 수정을 유발할 수 있는 수준