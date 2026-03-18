# 03. Player Identity & Nickname

## Overview

클라이언트 식별 및 닉네임 관리 정책을 정의합니다.

## UUID Cookie 기반 인증

### 쿠키 설정
- **Name**: `player_uuid`
- **Value**: UUID v4
- **httpOnly**: true (JavaScript 접근 불가)
- **secure**: true (HTTPS에서만 전송, 개발 환경에서는 false)
- **sameSite**: 'lax'
- **maxAge**: 365일 (1년)
- **path**: '/'

### 인증 흐름

1. 클라이언트가 서버에 최초 요청 (REST 또는 WebSocket)
2. 서버 미들웨어가 `player_uuid` 쿠키 확인
3. 쿠키가 없는 경우:
   - UUID v4 생성
   - Player 엔티티 생성 (nickname: null)
   - 응답에 쿠키 설정
4. 쿠키가 있는 경우:
   - DB에서 해당 UUID의 Player 존재 확인
   - 존재하지 않으면 새로 생성
5. WebSocket 연결 시:
   - handshake 헤더에서 쿠키 추출
   - 소켓에 playerUuid 바인딩

### REST API

#### GET /player/me
- 자신의 정보 조회 (uuid, nickname)
- 쿠키 자동 설정 (미설정 시)

#### POST /player/nickname
- Body: `{ "nickname": "string" }`
- 닉네임 설정/변경
- 응답: `{ "uuid": "...", "nickname": "..." }`

## 닉네임 정책

### 설정 규칙
- 2~20자
- 영문, 한글, 숫자, 언더스코어(_) 허용
- 앞뒤 공백 자동 제거 (trim)
- 대소문자 구분 (Case-sensitive)

### 고유성
- 다른 클라이언트가 사용 중인 닉네임은 설정 불가
- UNIQUE 제약 조건으로 DB 레벨에서 보장

### 닉네임 미설정 시 제한
닉네임이 NULL인 상태에서는 다음 행동 불가:
- Room 생성
- Room 참여 (join)
- NicknameRequiredGuard로 차단

### 닉네임 변경
- 언제든 변경 가능
- 변경 시 기존 게임 히스토리도 자동 반영
  - GameParticipant가 playerUuid(FK)로 Player를 참조하므로, Player.nickname 변경 시 모든 조회에서 새 닉네임으로 표시됨

### 새로고침 대응
- httpOnly 쿠키이므로 브라우저에 자동 보존
- 새로고침 시 쿠키와 함께 요청 → 기존 Player 정보 유지

## 동시 접속 제한

- 하나의 UUID(클라이언트)는 동시에 하나의 Room에만 참여 가능
- Room join 시 이미 다른 Room에 참여 중인지 확인
- 위반 시 에러 반환: "이미 다른 게임에 참여 중입니다"
