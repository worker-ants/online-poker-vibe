# 코드 리뷰 조치 내역

## Critical 조치

### 1. leaveRoom 트랜잭션 및 SRP 개선
- **문제**: `leaveRoom`의 다단계 삭제가 트랜잭션 없이 실행, RoomService가 Game 도메인을 직접 관리
- **조치**: `GameService.deleteByRoom(roomId)` 메서드를 추가하여 Game 도메인 삭제 책임을 GameService로 이전. 해당 메서드 내부에서 트랜잭션으로 `GameParticipant → Game` 순서로 삭제
- **파일**: `game.service.ts`, `room.service.ts`

### 2. 동시성(TOCTOU) 경쟁 조건
- **문제**: 두 플레이어 동시 퇴장 시 중복 삭제 가능
- **조치**: `deleteByRoom` 내부 트랜잭션 적용으로 원자성 보장. SQLite의 직렬화 특성과 함께 경쟁 조건 완화

### 3. RoomService의 Game 도메인 직접 관리 (SRP 위반)
- **문제**: RoomModule이 Game/GameParticipant 엔티티를 직접 등록하고 삭제 순서까지 관리
- **조치**: `RoomService`에서 Game/GameParticipant Repository 제거, `GameService` 주입으로 대체. `RoomModule`에서 Game/GameParticipant TypeOrmModule.forFeature 등록 제거
- **파일**: `room.service.ts`, `room.module.ts`

## WARNING 조치

### 1. CASCADE vs 수동 삭제 전략 통일
- **문제**: `onDelete: 'CASCADE'`와 수동 삭제 로직이 동시 존재
- **조치**: CASCADE는 안전장치로 유지, 실제 삭제는 `GameService.deleteByRoom()`의 명시적 트랜잭션으로 수행. RoomService에서 직접 Game/GameParticipant를 조작하는 코드 제거

### 2. SQLite FK 기본 비활성화
- **문제**: SQLite는 기본적으로 `PRAGMA foreign_keys = OFF`로 CASCADE가 무시될 수 있음
- **조치**: `database.module.ts`에 `prepareDatabase` 콜백으로 `PRAGMA foreign_keys = ON` 추가
- **파일**: `database.module.ts`

### 3. GameParticipant → Player CASCADE 정책
- **문제**: Player 삭제 시 GameParticipant도 연쇄 삭제되어 게임 전적 유실 가능
- **조치**: `onDelete: 'CASCADE'` → `onDelete: 'RESTRICT'`로 변경하여 전적 보존
- **파일**: `game-participant.entity.ts`

### 4. RoomModule 소유권 혼재
- **문제**: 동일 엔티티를 두 모듈이 관리
- **조치**: RoomModule에서 Game/GameParticipant 직접 등록 제거, GameService를 통해서만 접근
- **파일**: `room.module.ts`

### 5. 테스트 보강
- **조치**: `room.service.spec.ts`에서 Game/GameParticipant Repository mock을 `mockGameService`로 교체, `deleteByRoom` 호출 검증 추가
- **파일**: `room.service.spec.ts`

## INFO 조치

### 1. Card.tsx fallback 색상
- **문제**: `suitColor` fallback이 `'text-white'`로 되어 있어 변경 취지와 불일치
- **조치**: fallback을 `'text-gray-900'`으로 변경
- **파일**: `Card.tsx`

## 미조치 사항

### 통합 테스트 (INFO #3)
- `onDelete: 'CASCADE'` DB 레벨 동작은 단위 테스트로 검증 불가하므로 향후 SQLite in-memory 통합 테스트 추가 검토 필요

### Card 색상 변경 스냅샷 테스트 (INFO #4)
- 기존 Card.spec.tsx에서 suit symbol 렌더링은 검증 중. 색상 클래스 검증은 향후 추가 검토
