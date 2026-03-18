# 01. System Architecture

## Overview

온라인 멀티플레이어 포커 게임의 전체 시스템 아키텍처를 정의합니다.

## Tech Stack

### Backend
- **Framework**: NestJS 11
- **Runtime**: Node.js
- **Database**: SQLite (TypeORM)
- **Real-time**: Socket.IO (@nestjs/websockets + @nestjs/platform-socket.io)
- **Authentication**: Secure httpOnly Cookie (UUID)
- **Validation**: class-validator, class-transformer

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **State Management**: Zustand (game state), React Context (identity, socket)
- **Real-time**: Socket.IO Client

## Communication

```
┌─────────────┐    HTTP (REST)    ┌─────────────┐    TypeORM    ┌────────┐
│   Frontend   │ ◄──────────────► │   Backend    │ ◄──────────► │ SQLite │
│  (Next.js)   │    WebSocket     │  (NestJS)    │              │   DB   │
│  Port 3001   │ ◄──────────────► │  Port 3000   │              └────────┘
└─────────────┘                   └─────────────┘
```

### REST API
- Player 관련 (닉네임 설정, 내 정보 조회)
- Room CRUD (목록 조회, 생성)
- Hall of Fame (순위 조회, 전적 조회)

### WebSocket (Socket.IO)
- Room 실시간 업데이트 (join, leave, ready, kick)
- 게임 진행 (카드 딜링, 베팅, 결과)
- 클라이언트 상태 동기화

## Security Principles

1. **모든 비즈니스 로직은 서버에서 처리** — 클라이언트 데이터는 신뢰하지 않음
2. **카드 정보 보호** — 서버만 전체 덱을 알고 있으며, 각 플레이어에게 자신의 카드만 전송
3. **UUID 기반 인증** — httpOnly secure cookie로 클라이언트 식별
4. **입력 검증** — class-validator로 모든 입력 데이터 검증
5. **동시 접속 제한** — 하나의 클라이언트는 동시에 하나의 게임에만 참여 가능

## Monorepo Structure

```
/online-poker-vibe
  ├── spec/              # 스펙 문서
  ├── review/            # 코드 리뷰
  ├── backend/           # NestJS 서버
  │   └── src/
  │       ├── common/    # 공유 유틸리티, 가드, 데코레이터
  │       ├── database/  # TypeORM + SQLite 설정
  │       ├── player/    # 플레이어 인증 + 닉네임
  │       ├── room/      # Room 관리
  │       ├── game/      # 게임 진행 + 포커 엔진
  │       └── hall-of-fame/  # 순위 시스템
  └── frontend/          # Next.js 클라이언트
      ├── app/           # Pages (App Router)
      ├── components/    # React 컴포넌트
      ├── lib/           # 유틸리티, 타입, 상수
      ├── hooks/         # Custom hooks
      └── providers/     # Context providers
```

## Key Design Decisions

1. **In-Memory Game State**: 활성 게임 상태는 메모리(Map)에 보관. 게임 결과만 DB에 저장. 서버 재시작 시 진행 중인 게임은 소실됨 (캐주얼 게임에 적합).
2. **Strategy Pattern for Variants**: 포커 변형별 엔진이 공통 인터페이스(IPokerEngine)를 구현. 공유 유틸리티(Deck, HandEvaluator, BettingRound)를 조합.
3. **Immutable GameState**: 엔진 메서드가 새 상태 객체를 반환. 변이 없이 상태 전환을 추적하여 테스트와 디버깅 용이.
4. **SQLite**: 별도 DB 서버 불필요. 소규모 프로젝트에 적합. TypeORM으로 추상화하여 추후 DB 변경 가능.
