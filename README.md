# Online Poker Vibe

실시간 멀티플레이어 온라인 포커 게임입니다. 3가지 포커 변형과 2가지 게임 모드를 지원하며, AI 플레이어와 함께 플레이할 수 있습니다.

## 주요 기능

### 포커 변형
- **Texas Hold'em** - 2장의 홀 카드와 5장의 커뮤니티 카드
- **Five Card Draw** - 5장의 카드를 받고 교환하여 족보 완성
- **Seven Card Stud** - 7장의 카드 중 최적의 5장으로 족보 완성

### 게임 모드
- **Tournament** - 동일한 시작 칩, 점진적 블라인드 상승, 마지막 1명이 남으면 우승
- **Cash Game** - 고정 블라인드, 자유로운 입퇴장, 칩 변동 기준 결과 기록

### 기타 기능
- **AI 플레이어** - 빈 자리를 채우는 AI 플레이어 (핸드 강도 평가 기반 의사결정)
- **Hall of Fame** - 승률 기반 플레이어 랭킹 및 전적 조회
- **실시간 통신** - Socket.IO 기반 실시간 게임 진행
- **쿠키 인증** - UUID 기반 httpOnly 쿠키로 별도 회원가입 없이 플레이

## Tech Stack

| 구분 | 기술 |
|------|------|
| **Backend** | NestJS 11, TypeORM, SQLite, Socket.IO |
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand |
| **Real-time** | Socket.IO (WebSocket) |
| **Testing** | Jest (Backend), Vitest (Frontend) |

## 프로젝트 구조

```
/online-poker-vibe
  ├── spec/                # 스펙 문서 (Spec-Driven Development)
  ├── review/              # 코드 리뷰
  ├── backend/             # NestJS 서버 (Port 3000)
  │   └── src/
  │       ├── common/      # 공유 유틸리티, 가드, 데코레이터
  │       ├── database/    # TypeORM + SQLite 설정
  │       ├── player/      # 플레이어 인증 + 닉네임
  │       ├── room/        # Room 관리
  │       ├── game/        # 게임 진행 + 포커 엔진
  │       └── hall-of-fame/  # 순위 시스템
  └── frontend/            # Next.js 클라이언트 (Port 3001)
      ├── app/             # Pages (App Router)
      ├── components/      # React 컴포넌트
      ├── lib/             # 유틸리티, 타입, 상수
      ├── hooks/           # Custom hooks
      └── providers/       # Context providers
```

## 시작하기

### 사전 요구사항

- Node.js (v18 이상)
- npm

### 설치

```bash
# Backend 의존성 설치
cd backend
npm install

# Frontend 의존성 설치
cd ../frontend
npm install
```

### 실행

**Backend 서버 실행** (Port 3000):
```bash
cd backend
npm run start:dev
```

**Frontend 클라이언트 실행** (Port 3001):
```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:3001`로 접속하여 게임을 시작합니다.

### 테스트

```bash
# Backend 테스트
cd backend
npm test

# Frontend 테스트
cd frontend
npm test
```

### Lint

```bash
# Backend lint
cd backend
npm run lint

# Frontend lint
cd frontend
npm run lint
```

## 게임 플레이 방법

1. **닉네임 설정** - 첫 접속 시 닉네임을 설정합니다 (2~20자, 영숫자 및 밑줄)
2. **방 생성 또는 참여** - 로비에서 새 방을 만들거나 기존 방에 참여합니다
3. **게임 설정** - 방 생성 시 포커 변형, 게임 모드, 최대 인원, 시작 칩 등을 설정합니다
4. **준비** - 모든 플레이어가 준비 완료하면 게임이 자동 시작됩니다 (최소 2명)
5. **게임 진행** - 베팅 액션(Fold, Check, Call, Raise, All-in)으로 게임을 진행합니다
6. **결과 확인** - Hall of Fame에서 전체 랭킹과 개인 전적을 확인할 수 있습니다

## 페이지 구성

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Lobby | 방 목록, 방 생성, 닉네임 설정 |
| `/game/[roomId]` | Game Screen | 포커 테이블, 플레이어 정보, 베팅 액션 |
| `/hall-of-fame` | Hall of Fame | 플레이어 랭킹, 개인 전적 |

## API

### REST API
- `GET /player/me` - 내 정보 조회
- `PUT /player/nickname` - 닉네임 설정
- `GET /rooms` - 방 목록 조회
- `POST /rooms` - 방 생성
- `GET /hall-of-fame` - 랭킹 조회 (페이징)
- `GET /hall-of-fame/:uuid/history` - 플레이어 전적 조회

### WebSocket Events
- **Room**: 입장, 퇴장, 준비, 강퇴
- **Game**: 게임 시작, 상태 동기화, 베팅 액션, 쇼다운, 결과