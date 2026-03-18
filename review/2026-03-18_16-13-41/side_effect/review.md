## Side Effect Code Review

### 발견사항

---

**[WARNING] `DatabaseModule` - `synchronize: true` in production risk**
- 위치: `backend/src/database/database.module.ts:11`
- 상세: `synchronize: true`는 서버 시작 시 자동으로 DB 스키마를 변경합니다. 프로덕션 환경에서는 데이터 손실을 유발할 수 있습니다.
- 제안: 환경별로 분기 처리 - `synchronize: process.env.NODE_ENV !== 'production'`

---

**[WARNING] `SevenCardStudEngine` / `TexasHoldemEngine` - 인스턴스 단위 `Deck` 상태 공유**
- 위치: `seven-card-stud.engine.ts:22-25`, `texas-holdem.engine.ts:22-25`
- 상세: `private deck = new Deck()`이 클래스 인스턴스 필드로 선언되어 있습니다. 동일 `PokerEngineFactory.createEngine()`으로 생성된 엔진 인스턴스가 여러 게임에 재사용되지는 않지만, `startHand`에서 `this.deck.reset()`을 호출하지 않으면 이전 핸드의 덱 상태가 유지될 수 있습니다. 현재는 `this.deck.reset()` 후 `shuffle()`을 호출하므로 문제없으나, `newState.deck = this.deck.getCards()`로 상태에 덱 참조를 저장한 뒤 이후 `deckCards = [...newState.deck]`으로 복사하는 방식이 혼재되어 있어 추적이 어렵습니다.
- 제안: 엔진을 stateless로 만들거나, `Deck`을 GameState에만 포함시켜 엔진 인스턴스 간 공유 위험을 제거

---

**[WARNING] `GameService.activeGames` - 인메모리 상태의 프로세스 재시작 손실**
- 위치: `backend/src/game/game.service.ts:27`
- 상세: `private activeGames = new Map<string, ActiveGame>()`은 NestJS 서비스 싱글톤 인스턴스 메모리에 저장됩니다. 서버 재시작 시 진행 중인 모든 게임 상태가 소실되며, DB에는 `in-progress` 상태로 남아 정합성이 깨집니다.
- 제안: 서버 시작 시 `in-progress` 게임을 `abandoned`로 업데이트하는 초기화 로직 추가

---

**[WARNING] `GameService.handleAction` - `finishGame` 이후 `getGameResult` 호출 순서 문제**
- 위치: `backend/src/game/game.service.ts:148-158`
- 상세: `finishGame()` 내부에서 `this.activeGames.delete(active.roomId)`를 호출한 뒤, 동일한 `active` 참조로 `getGameResult(active)`를 호출합니다. `getGameResult`는 DB를 조회하므로 직접적인 버그는 아니나, `active` 객체가 이미 Map에서 제거된 후 사용되어 코드 흐름이 혼란스럽습니다.
- 제안: `gameResult`를 `finishGame()` 내부에서 반환하거나, 삭제 전에 결과를 수집

---

**[WARNING] `PlayerController` - `@Res()` 사용으로 NestJS 인터셉터/파이프 무력화**
- 위치: `backend/src/player/player.controller.ts:14, 33`
- 상세: `@Res()` 데코레이터를 사용하면 NestJS의 응답 인터셉터, 직렬화 파이프가 자동으로 적용되지 않습니다. 특히 `res.json()`을 직접 호출하므로, 전역 `ValidationPipe`의 `transform` 옵션도 응답에는 영향을 주지 않습니다.
- 제안: `@Res({ passthrough: true })`를 사용하거나, 쿠키 설정 로직을 미들웨어/인터셉터로 분리

---

**[WARNING] `RoomController` - `(req as any).cookies` 타입 우회**
- 위치: `backend/src/room/room.controller.ts:20`
- 상세: `(req as any).cookies`로 타입을 우회합니다. `PlayerController`는 `@Req() req: Request`로 올바르게 처리하는데 `RoomController`만 `as any`를 사용해 타입 안전성이 없습니다.
- 제안: `import type { Request } from 'express'`를 사용하고 `@PlayerUuid()` 커스텀 데코레이터(이미 구현됨)를 활용

---

**[INFO] `.gitignore` - `.env` 전역 무시로 인한 기존 파일 추적 해제 가능성**
- 위치: `.gitignore:15`
- 상세: `.env`를 루트 `.gitignore`에 추가했을 때, 이미 git이 추적 중인 `.env` 파일이 있다면 `git rm --cached .env`를 별도로 실행하지 않으면 계속 추적됩니다. 반대로 `backend/.env`, `frontend/.env`가 처음부터 없었다면 문제없습니다.
- 제안: `git ls-files --ignored --exclude-standard`로 확인 후 필요 시 `git rm --cached` 적용

---

**[INFO] `BettingRound.findNextActivePlayer` - 모든 플레이어 폴드/올인 시 자기 자신 반환**
- 위치: `backend/src/game/engine/betting-round.ts:218`
- 상세: 활성 플레이어가 없을 때 `fromIndex`를 반환합니다. 이 경우 이미 폴드/올인된 플레이어의 인덱스가 `currentPlayerIndex`로 설정되어, 이후 `getActionRequired`에서 해당 플레이어를 current로 잘못 식별할 수 있습니다.
- 제안: `-1` 또는 `null`을 반환하고 호출부에서 처리

---

**[INFO] `HallOfFameService.getPlayerHistory` - N+1 쿼리**
- 위치: `backend/src/hall-of-fame/hall-of-fame.service.ts:119-143`
- 상세: 각 participation에 대해 `this.participantRepository.find({ where: { gameId: game.id } })`를 반복 호출합니다. 게임 수가 많을수록 DB 쿼리가 선형으로 증가합니다.
- 제안: `JOIN`을 활용해 단일 쿼리로 처리

---

**[INFO] `GamePage` - `socket.emit(ROOM_JOIN)` 중복 호출 가능성**
- 위치: `frontend/app/game/[roomId]/page.tsx:57-61`
- 상세: `useEffect`가 `socket` 또는 `roomId` 변경 시 재실행되며, `ROOM_JOIN` 이벤트가 여러 번 emit될 수 있습니다. "idempotent"라고 주석이 있으나 서버 게이트웨이에서 중복 처리를 보장하는지 확인 필요합니다.
- 제안: `ref`로 join 여부를 추적하거나 서버에서 중복 join 처리를 명시적으로 보장

---

### 요약

전반적으로 코드 변경사항은 온라인 포커 게임의 백엔드/프론트엔드 초기 구현으로, 구조는 잘 설계되어 있습니다. 주요 부작용 위험은 세 가지로 압축됩니다: (1) `synchronize: true` 설정은 프로덕션 배포 시 스키마 자동 변경으로 데이터 손실을 유발할 수 있고, (2) 인메모리 `activeGames` Map은 서버 재시작 시 진행 중인 게임 상태를 소실시켜 DB 정합성을 깨뜨릴 수 있으며, (3) 포커 엔진 클래스의 인스턴스 수준 `Deck` 상태는 현재 코드에서는 문제없으나 향후 엔진 인스턴스 재사용 시 의도치 않은 상태 공유 위험이 있습니다. `RoomController`의 타입 우회와 `PlayerController`의 `@Res()` 직접 사용은 NestJS의 인터셉터 체계를 무력화하는 설계적 문제입니다.

### 위험도

**MEDIUM**