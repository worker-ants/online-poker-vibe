## 성능 코드 리뷰

### 발견사항

---

**[WARNING] room.service.ts: 불필요한 수동 CASCADE 처리 — DB CASCADE로 대체 가능**
- 위치: `room.service.ts` leaveRoom() 내 게임/참가자 삭제 로직
- 상세: `onDelete: 'CASCADE'`가 이미 엔티티에 설정되어 있음에도, 서비스 레이어에서 게임과 참가자를 별도로 조회·삭제하는 로직이 추가됨. Room 삭제 시 DB CASCADE가 자동으로 Game → GameParticipant를 순서대로 삭제함. 현재 코드는 불필요한 DB 왕복 쿼리를 3회(find games, delete participants, remove games) 추가로 발생시킴.
- 제안: Room CASCADE → Game CASCADE → GameParticipant 체인이 DB 레벨에서 동작하므로, `roomRepository.remove(room)` 호출만으로 충분. 수동 삭제 블록 전체 제거 가능.

```ts
// 제거 가능한 코드
const games = await this.gameRepository.find({ where: { roomId } });
if (games.length > 0) {
  const gameIds = games.map((g) => g.id);
  await this.participantRepository.createQueryBuilder()...execute();
  await this.gameRepository.remove(games);
}
```

---

**[WARNING] room.service.ts: gameRepository.remove(games) — 단건 DELETE N회 실행**
- 위치: `leaveRoom()` 내 `this.gameRepository.remove(games)`
- 상세: TypeORM의 `remove(entities[])` 는 배열 각 항목에 대해 개별 DELETE 쿼리를 N회 실행함. 게임 수가 많을 경우 N+1 형태의 성능 저하 발생.
- 제안: 위 WARNING과 연계하여 수동 삭제 로직 자체를 제거하는 것이 최선. 유지가 필요하다면 `DELETE WHERE roomId = ?` 단일 쿼리로 대체:

```ts
await this.gameRepository.delete({ roomId });
```

---

**[INFO] room.service.ts: leaveRoom() 내 두 번의 순차적 DB 조회**
- 위치: `leaveRoom()` — roomPlayerRepository.findOne 후 roomRepository.findOne
- 상세: 두 조회가 순차적으로 실행되나 첫 번째 조회 결과(`roomPlayer`)가 두 번째 조회의 조건에 영향을 주지 않음. 병렬화 가능하나, `roomPlayer`가 없을 경우 조기 리턴이 발생하므로 현재 구조(early exit 패턴)는 의도적. 문제없음.

---

**[INFO] frontend Card.tsx: 색상 변경은 런타임 성능 영향 없음**
- 위치: `SUIT_COLORS` 객체
- 상세: `text-white` → `text-gray-900` 변경은 순수 스타일 수정으로 성능 영향 없음. Tailwind 클래스 참조만 변경되어 CSS 파싱 비용 차이 없음.

---

**[INFO] room.module.ts: 불필요한 Repository 등록**
- 위치: `TypeOrmModule.forFeature([Room, RoomPlayer, Game, GameParticipant])`
- 상세: 앞서 언급한 수동 삭제 로직이 제거되면 `Game`, `GameParticipant` Repository 주입 자체가 불필요해짐. 모듈이 불필요한 의존성을 로드하는 오버헤드는 미미하나, 코드 간결성 측면에서 정리가 필요.

---

### 요약

이번 변경의 핵심 성능 이슈는 **`onDelete: 'CASCADE'`가 이미 DB 레벨에서 설정되어 있음에도 서비스 레이어에서 중복으로 수동 삭제를 수행**한다는 점입니다. 이로 인해 Room 삭제 시 불필요한 쿼리 3회(games 조회, participants 삭제, games 삭제)가 추가 실행되며, `gameRepository.remove(games[])` 호출 방식은 게임 수에 비례한 N회 DELETE를 유발합니다. 해당 수동 삭제 블록을 제거하고 DB CASCADE에 위임하면 코드 간결화와 동시에 불필요한 DB 왕복을 완전히 제거할 수 있습니다. 나머지 변경사항(Card 색상, spec 문서)은 성능과 무관합니다.

### 위험도

**MEDIUM** — 현재 운영 규모에서 즉각적인 장애로 이어지지는 않으나, Room 삭제 빈도가 높아질 경우 불필요한 쿼리 누적이 DB 부하로 직결됩니다.