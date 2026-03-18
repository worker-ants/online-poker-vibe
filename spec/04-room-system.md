# 04. Room System

## Overview

게임 방 생성, 참여, 관리 시스템을 정의합니다.

## Room 상태 머신

```
          create            all ready + min 2 players
WAITING ──────────── PLAYING ────────────── FINISHED
   ▲                    │                       │
   │                    │ (cash: game end)       │
   └────────────────────┘                       │
         (tournament end, or all leave)         │
```

### 상태 설명
- **waiting**: 방 생성 후 게임 시작 전. 플레이어 입장/퇴장/준비 가능.
- **playing**: 게임 진행 중. 새로운 플레이어 입장 불가 (Tournament). Cash는 핸드 사이에 가능.
- **finished**: 게임 종료. Tournament 완료 또는 모든 플레이어 퇴장.

## Room 생성

### POST /rooms
```json
{
  "name": "My Poker Room",
  "variant": "texas-holdem",  // "texas-holdem" | "five-card-draw" | "seven-card-stud"
  "mode": "tournament",       // "tournament" | "cash"
  "maxPlayers": 6,            // 2~6
  "settings": {
    "startingChips": 1000,
    "smallBlind": 10,
    "bigBlind": 20,
    "blindSchedule": [...]    // Tournament only
  }
}
```

- 닉네임 설정 필수
- 생성자가 자동으로 host 및 첫 번째 플레이어로 등록
- seatIndex 0 배정

## Room 목록 조회

### GET /rooms
- status가 'waiting'인 Room만 반환
- 각 Room의 정보: id, name, variant, mode, playerCount, maxPlayers, hostNickname, createdAt

## Room 참여 (Join)

### WebSocket: room:join
- Payload: `{ roomId: string }`
- 조건:
  - 닉네임 설정 완료
  - Room status가 'waiting' (또는 Cash Game의 핸드 사이)
  - 최대 인원 미달
  - 이미 다른 Room에 참여 중이 아닌 상태
- 가용한 가장 낮은 seatIndex 배정
- 성공 시: room:updated 이벤트로 전체 Room 상태 브로드캐스트

## Room 퇴장 (Leave)

### WebSocket: room:leave
- Payload: `{ roomId: string }`
- 게임 진행 중 퇴장 = 게임 포기 (abandoned)
- Host가 퇴장 시:
  - 게임 시작 전: 다음 seatIndex의 플레이어가 host 승계
  - 모든 플레이어 퇴장 시: Room 삭제
- 성공 시: room:updated 브로드캐스트

## 준비 완료 (Ready)

### WebSocket: room:ready
- Payload: `{ roomId: string }`
- 토글 방식: ready ↔ not ready
- 게임 시작 전에만 가능
- Host 포함 모든 플레이어가 ready 상태여야 게임 시작 가능

## 추방 (Kick)

### WebSocket: room:kick
- Payload: `{ roomId: string, targetUuid: string }`
- 조건:
  - 요청자가 해당 Room의 host
  - 게임 시작 전에만 가능
  - 자기 자신은 추방 불가
- 추방된 플레이어에게 room:kicked 이벤트 전송
- room:updated 브로드캐스트

## 게임 시작 조건

모든 조건 충족 시 자동으로 게임 시작:
1. 최소 2명의 플레이어
2. 모든 플레이어가 ready 상태

게임 시작 시:
- Room status를 'playing'으로 변경
- Game 엔티티 생성
- 포커 엔진 초기화
- game:started 이벤트 브로드캐스트

## Room 설정 기본값

### Tournament
```json
{
  "startingChips": 1000,
  "smallBlind": 10,
  "bigBlind": 20,
  "blindSchedule": [
    { "level": 1, "smallBlind": 10, "bigBlind": 20, "handsPerLevel": 10 },
    { "level": 2, "smallBlind": 20, "bigBlind": 40, "handsPerLevel": 10 },
    { "level": 3, "smallBlind": 50, "bigBlind": 100, "handsPerLevel": 10 },
    { "level": 4, "smallBlind": 100, "bigBlind": 200, "handsPerLevel": 10 },
    { "level": 5, "smallBlind": 200, "bigBlind": 400, "handsPerLevel": 10 }
  ]
}
```

### Cash Game
```json
{
  "startingChips": 1000,
  "smallBlind": 10,
  "bigBlind": 20
}
```
