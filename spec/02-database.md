# 02. Database Schema

## Overview

SQLite + TypeORM을 사용한 데이터 영속화 스키마를 정의합니다.
SQLite 파일 경로: `backend/data/poker.sqlite`

## Entities

### Player

플레이어 식별 및 닉네임 관리.

| Column    | Type     | Constraints           | Description              |
|-----------|----------|-----------------------|--------------------------|
| uuid      | TEXT     | PK                    | UUID v4 (쿠키에서 할당)  |
| nickname  | TEXT     | UNIQUE, NULLABLE      | 표시 닉네임              |
| createdAt | DATETIME | NOT NULL, DEFAULT NOW | 최초 접속 시간           |
| updatedAt | DATETIME | NOT NULL, DEFAULT NOW | 마지막 수정 시간         |

- 닉네임은 초기에 NULL (미설정 상태)
- 닉네임 변경 시 updatedAt 갱신
- 닉네임 UNIQUE 제약으로 중복 방지

### Room

게임 방 정보.

| Column     | Type     | Constraints           | Description                          |
|------------|----------|-----------------------|--------------------------------------|
| id         | TEXT     | PK                    | UUID v4                              |
| name       | TEXT     | NOT NULL              | 방 이름                              |
| variant    | TEXT     | NOT NULL              | 'texas-holdem' / 'five-card-draw' / 'seven-card-stud' |
| mode       | TEXT     | NOT NULL              | 'tournament' / 'cash'               |
| status     | TEXT     | NOT NULL, DEFAULT 'waiting' | 'waiting' / 'playing' / 'finished' |
| hostUuid   | TEXT     | FK → Player(uuid)     | 방장 UUID                            |
| maxPlayers | INTEGER  | NOT NULL, DEFAULT 6   | 최대 플레이어 수 (2~6)              |
| settings   | TEXT     | NOT NULL              | JSON: 시작 칩, 블라인드 등 설정      |
| createdAt  | DATETIME | NOT NULL, DEFAULT NOW | 생성 시간                            |

**settings JSON 구조:**
```json
{
  "startingChips": 1000,
  "smallBlind": 10,
  "bigBlind": 20,
  "blindSchedule": [          // Tournament only
    { "level": 1, "smallBlind": 10, "bigBlind": 20, "handsPerLevel": 10 },
    { "level": 2, "smallBlind": 20, "bigBlind": 40, "handsPerLevel": 10 }
  ],
  "ante": 0                   // 7 Card Stud에서 사용
}
```

### RoomPlayer

Room 내 플레이어 참여 정보.

| Column     | Type     | Constraints            | Description            |
|------------|----------|------------------------|------------------------|
| id         | INTEGER  | PK, AUTO INCREMENT     |                        |
| roomId     | TEXT     | FK → Room(id)          |                        |
| playerUuid | TEXT     | FK → Player(uuid)      |                        |
| seatIndex  | INTEGER  | NOT NULL               | 좌석 번호 (0~5)       |
| isReady    | BOOLEAN  | NOT NULL, DEFAULT FALSE| 준비 완료 상태         |
| joinedAt   | DATETIME | NOT NULL, DEFAULT NOW  | 입장 시간              |

- UNIQUE(roomId, playerUuid) — 같은 방에 중복 참여 불가
- UNIQUE(roomId, seatIndex) — 같은 좌석 중복 불가

### Game

진행된 게임(토너먼트 세션 또는 캐시 세션)의 기록.

| Column     | Type     | Constraints            | Description                     |
|------------|----------|------------------------|---------------------------------|
| id         | TEXT     | PK                     | UUID v4                         |
| roomId     | TEXT     | FK → Room(id)          |                                 |
| variant    | TEXT     | NOT NULL               | 게임 시작 시점의 변형 스냅샷     |
| mode       | TEXT     | NOT NULL               | 게임 시작 시점의 모드 스냅샷     |
| status     | TEXT     | NOT NULL               | 'in-progress' / 'completed' / 'abandoned' |
| startedAt  | DATETIME | NOT NULL               | 게임 시작 시간                   |
| finishedAt | DATETIME | NULLABLE               | 게임 종료 시간                   |

### GameParticipant

게임 내 각 플레이어의 결과.

| Column     | Type     | Constraints            | Description                           |
|------------|----------|------------------------|---------------------------------------|
| id         | INTEGER  | PK, AUTO INCREMENT     |                                       |
| gameId     | TEXT     | FK → Game(id)          |                                       |
| playerUuid | TEXT     | FK → Player(uuid)      |                                       |
| result     | TEXT     | NOT NULL               | 'win' / 'loss' / 'draw' / 'abandoned'|
| chipsDelta | INTEGER  | NOT NULL, DEFAULT 0    | 칩 변동량 (순수익)                    |
| finalChips | INTEGER  | NOT NULL, DEFAULT 0    | 최종 칩 보유량                        |
| placement  | INTEGER  | NULLABLE               | 순위 (Tournament: 1st, 2nd... / Cash: NULL) |

- UNIQUE(gameId, playerUuid) — 게임당 플레이어 1개 기록

## Relations

```
Player (1) ──< RoomPlayer (N) >── (1) Room
Player (1) ──< GameParticipant (N) >── (1) Game
Room   (1) ──< Game (N)
```

## Indexes

- `Player.nickname` — UNIQUE INDEX (닉네임 중복 검사 최적화)
- `Game.status` — INDEX (진행 중 게임 조회)
- `GameParticipant.playerUuid` — INDEX (플레이어별 전적 조회)
- `Room.status` — INDEX (대기 중 방 목록 조회)
