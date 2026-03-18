# 07. WebSocket Events

## Overview

Socket.IO 기반 실시간 통신의 모든 이벤트를 정의합니다.

## Connection

### 연결 설정
- Transport: WebSocket (polling fallback)
- Path: `/socket.io`
- withCredentials: true (쿠키 전송)
- Reconnection: 자동 재접속 (exponential backoff)

### 연결 시 인증
1. 클라이언트가 Socket.IO 연결 시도
2. 서버 Gateway의 `handleConnection`에서 handshake 쿠키 추출
3. `player_uuid` 쿠키로 Player 확인/생성
4. 소켓에 playerUuid 바인딩
5. `identity:confirmed` 이벤트 전송

---

## Client → Server Events

### identity:set-nickname
닉네임 설정/변경
```typescript
// Payload
{ nickname: string }

// Response (acknowledgement)
{ success: true, nickname: string }
// or
{ success: false, error: string }
```

### room:list
현재 입장 가능한 Room 목록 요청
```typescript
// Payload: none

// Response
Room[]
```

### room:create
새 Room 생성
```typescript
// Payload
{
  name: string;
  variant: 'texas-holdem' | 'five-card-draw' | 'seven-card-stud';
  mode: 'tournament' | 'cash';
  maxPlayers: number;  // 2~6
  settings: {
    startingChips: number;
    smallBlind: number;
    bigBlind: number;
    ante?: number;
    blindSchedule?: BlindLevel[];
  }
}

// Response
{ success: true, roomId: string }
// or
{ success: false, error: string }
```

### room:join
Room 입장
```typescript
// Payload
{ roomId: string }

// Response
{ success: true, room: RoomState }
// or
{ success: false, error: string }
```

### room:leave
Room 퇴장
```typescript
// Payload
{ roomId: string }
```

### room:ready
준비 완료 토글
```typescript
// Payload
{ roomId: string }
```

### room:kick
플레이어 추방 (Host만 가능)
```typescript
// Payload
{ roomId: string, targetUuid: string }

// Response
{ success: true }
// or
{ success: false, error: string }
```

### game:action
게임 액션 수행
```typescript
// Payload
{
  roomId: string;
  action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
  amount?: number;          // raise 시 금액
  discardIndices?: number[]; // 5 Card Draw의 draw phase에서 교환할 카드 인덱스
}

// Response
{ success: true }
// or
{ success: false, error: string }
```

---

## Server → Client Events

### identity:confirmed
연결 후 인증 확인
```typescript
{
  playerId: string;
  nickname: string | null;
}
```

### room:list:update
Room 목록 업데이트 (전체 스냅샷)
```typescript
Room[]

// Room
{
  id: string;
  name: string;
  variant: string;
  mode: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  hostNickname: string;
  createdAt: string;
}
```

### room:updated
Room 상태 변경 (해당 Room 참여자에게만)
```typescript
{
  roomId: string;
  players: {
    uuid: string;
    nickname: string;
    seatIndex: number;
    isReady: boolean;
    isHost: boolean;
  }[];
  status: string;
}
```

### room:kicked
추방 알림 (추방된 플레이어에게만)
```typescript
{
  roomId: string;
  reason: string;
}
```

### game:started
게임 시작
```typescript
{
  roomId: string;
  gameId: string;
  variant: string;
  mode: string;
}
```

### game:state
공개 게임 상태 (해당 Room 참여자에게)
```typescript
{
  phase: string;
  communityCards: Card[];        // Hold'em: 0~5장, Draw: 없음, Stud: 없음
  pot: number;
  sidePots: { amount: number; playerUuids: string[] }[];
  currentPlayerUuid: string | null;
  dealerUuid: string;
  players: {
    uuid: string;
    nickname: string;
    seatIndex: number;
    chips: number;
    currentBet: number;
    isFolded: boolean;
    isAllIn: boolean;
    isDisconnected: boolean;
    visibleCards: Card[];        // 공개된 카드 (Stud의 face-up 카드)
    cardCount: number;           // 비공개 카드 수 (다른 플레이어의 카드 수)
  }[];
  handNumber: number;
  blindLevel?: number;           // Tournament only
}
```

### game:private
개인 카드 정보 (해당 플레이어에게만)
```typescript
{
  holeCards: Card[];             // 자신의 비공개 카드
}
```

### game:action-required
턴 알림 (현재 턴 플레이어에게)
```typescript
{
  playerUuid: string;
  validActions: ('fold' | 'check' | 'call' | 'raise' | 'all-in')[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  timeLimit: number;             // 초 단위
}
```

### game:action-performed
다른 플레이어의 액션 알림 (전체)
```typescript
{
  playerUuid: string;
  action: string;
  amount?: number;
}
```

### game:showdown
핸드 종료 시 공개
```typescript
{
  players: {
    uuid: string;
    cards: Card[];               // 전체 카드 공개
    handRank: string;            // "Full House", "Flush" 등
    handDescription: string;     // "Full House, Kings over Tens"
  }[];
  winners: {
    uuid: string;
    amount: number;              // 획득 칩
    potType: 'main' | 'side';
  }[];
}
```

### game:ended
게임 완전 종료
```typescript
{
  roomId: string;
  gameId: string;
  results: {
    uuid: string;
    nickname: string;
    result: 'win' | 'loss' | 'draw' | 'abandoned';
    chipsDelta: number;
    placement?: number;
  }[];
}
```

### game:hand-started
새 핸드 시작 (Tournament/Cash 다중 핸드)
```typescript
{
  handNumber: number;
  dealerUuid: string;
  blindLevel?: number;
  smallBlind: number;
  bigBlind: number;
}
```

### timer:tick
턴 타이머
```typescript
{
  playerUuid: string;
  remainingSeconds: number;
}
```

### error
에러 알림
```typescript
{
  code: string;
  message: string;
}
```

---

## Socket.IO Room 매핑

각 포커 Room은 Socket.IO의 room 기능으로 관리:
- Room 입장 시: `socket.join(roomId)`
- Room 퇴장 시: `socket.leave(roomId)`
- Room 내 브로드캐스트: `server.to(roomId).emit(...)`
- 개인 메시지: `server.to(socketId).emit(...)`
