# 06. Game Modes

## Overview

Tournament과 Cash Game 두 가지 게임 모드의 차이점을 정의합니다.

## Tournament Mode

### 개요
모든 플레이어가 동일한 시작 칩을 가지고 시작. 칩을 모두 잃은 플레이어는 탈락. 마지막 1명이 남으면 우승.

### 특성
| 항목 | 설명 |
|------|------|
| 시작 칩 | 모든 플레이어 동일 (기본: 1000) |
| 블라인드 | 점진적 상승 (blindSchedule에 따라) |
| 입장 | 게임 시작 후 입장 불가 |
| 퇴장 | 게임 중 퇴장 = 포기(abandoned), 칩 몰수 |
| 탈락 | 칩 0 = 탈락, 순위 확정 |
| 종료 조건 | 마지막 1명 남을 때 |
| 결과 기록 | 각 플레이어의 placement (1위, 2위, ...) |

### Blind Schedule
```typescript
interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  handsPerLevel: number;  // 이 레벨에서의 핸드 수
}
```

- 매 `handsPerLevel` 핸드마다 다음 레벨로 상승
- 마지막 레벨 도달 시 해당 레벨 유지
- 블라인드 상승으로 게임 진행 가속화

### 게임 결과
- **1위 (마지막 생존)**: result = 'win'
- **2위~ (탈락 순서 역순)**: result = 'loss', placement 기록
- **중도 이탈**: result = 'abandoned', 즉시 탈락 처리

### 다중 핸드 진행
- 핸드 종료 후 탈락자 확인
- 2명 이상 남아있으면 다음 핸드 시작
- 딜러 버튼 시계 방향 이동
- 블라인드 레벨 체크 및 적용

## Cash Game Mode

### 개요
자유로운 입퇴장이 가능한 모드. 블라인드가 고정되며, 원하는 만큼 플레이 후 퇴장 가능.

### 특성
| 항목 | 설명 |
|------|------|
| 시작 칩 | 설정된 기본 칩 (기본: 1000) |
| 블라인드 | 고정 (상승하지 않음) |
| 입장 | 핸드 사이에 자유 입장 가능 |
| 퇴장 | 핸드 사이에 자유 퇴장 가능 |
| 탈락 | 칩 0이 되면 자동 퇴장 (재입장 시 기본 칩으로 복귀) |
| 종료 조건 | 모든 플레이어 퇴장 시 |
| 결과 기록 | 칩 변동 기준 (양수: win, 음수: loss, 동일: draw) |

### 입퇴장 규칙
- **입장**: 현재 핸드가 진행 중이면 대기, 다음 핸드부터 참여
- **퇴장**: 현재 핸드가 진행 중이면 핸드 종료 후 퇴장 (또는 즉시 fold 후 퇴장)
- **재입장**: 퇴장 후 다시 입장 가능, 기본 시작 칩으로 시작

### 게임 결과 (세션 기준)
- Cash Game의 "게임"은 플레이어가 Room에 참여한 세션 전체를 1게임으로 기록
- **chipsDelta > 0**: result = 'win'
- **chipsDelta < 0**: result = 'loss'
- **chipsDelta = 0**: result = 'draw'
- **핸드 진행 중 연결 끊김**: result = 'abandoned'

## IGameMode Interface

```typescript
interface IGameMode {
  readonly mode: 'tournament' | 'cash';

  getSmallBlind(handNumber: number): number;
  getBigBlind(handNumber: number): number;
  getAnte(handNumber: number): number;
  getStartingChips(): number;

  canPlayerLeave(): boolean;          // cash: true, tournament: false
  canPlayerJoinMidGame(): boolean;    // cash: true, tournament: false
  isPlayerEliminated(chips: number): boolean;
  isGameOver(activePlayers: number): boolean;
}
```

## Mode-Variant 조합

모든 3가지 변형(Texas Hold'em, 5 Card Draw, 7 Card Stud)은 두 가지 모드 모두와 조합 가능합니다.

| 조합 | 블라인드/안테 | 특이사항 |
|------|-------------|---------|
| Hold'em + Tournament | Blind 점진 상승 | 가장 일반적인 조합 |
| Hold'em + Cash | Blind 고정 | 일반적 |
| 5 Card Draw + Tournament | Blind 점진 상승 | |
| 5 Card Draw + Cash | Blind 고정 | |
| 7 Card Stud + Tournament | Ante 점진 상승 | Bring-in도 상승 |
| 7 Card Stud + Cash | Ante 고정 | |
