# 05. Poker Engine

## Overview

3가지 포커 변형의 게임 룰, 핸드 랭킹, 베팅 라운드를 정의합니다.
포커 엔진은 순수 TypeScript로 구현하며, NestJS에 의존하지 않습니다.

## Hand Rankings (모든 변형 공통)

높은 순서부터:

| Rank | Name              | Description                          |
|------|-------------------|--------------------------------------|
| 1    | Royal Flush       | A-K-Q-J-10 같은 무늬                |
| 2    | Straight Flush    | 연속 5장 같은 무늬                   |
| 3    | Four of a Kind    | 같은 숫자 4장                        |
| 4    | Full House        | Three of a Kind + One Pair           |
| 5    | Flush             | 같은 무늬 5장                        |
| 6    | Straight          | 연속 5장 (무늬 무관)                 |
| 7    | Three of a Kind   | 같은 숫자 3장                        |
| 8    | Two Pair          | 2개의 페어                           |
| 9    | One Pair          | 1개의 페어                           |
| 10   | High Card         | 위 조합 없음                         |

### 특수 규칙
- Ace는 High(A-K-Q-J-10)와 Low(A-2-3-4-5) 모두 가능 (Straight에서)
- A-2-3-4-5는 가장 낮은 Straight (Wheel)
- 같은 랭크일 경우 Kicker로 비교
- Kicker도 동일하면 Split Pot (draw)

## Card & Deck

### Card
```typescript
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface Card {
  suit: Suit;
  rank: Rank;
}
```

### Deck
- 52장의 표준 카드 덱
- Fisher-Yates 셔플 알고리즘
- `shuffle()`: 덱 섞기
- `deal(count)`: 상위 N장 꺼내기

## Betting Actions

모든 변형에서 공통으로 사용하는 베팅 액션:

| Action  | Description                                      |
|---------|--------------------------------------------------|
| fold    | 핸드 포기, 팟 참여 권리 상실                     |
| check   | 베팅 없이 턴 넘김 (현재 베팅이 0일 때만 가능)   |
| call    | 현재 베팅과 동일한 금액 베팅                     |
| raise   | 현재 베팅보다 높은 금액 베팅                     |
| all-in  | 보유한 모든 칩 베팅                              |

### 베팅 라운드 규칙
- 시계 방향으로 진행
- 모든 활성 플레이어가 동일한 금액을 베팅하면 라운드 종료
- 최소 레이즈 금액 = 이전 레이즈 금액 (또는 빅 블라인드)
- All-in은 보유 칩이 콜 금액보다 적을 때도 가능 (사이드 팟 생성)

## Side Pot Calculation

All-in 시 사이드 팟 계산:
1. 가장 적은 All-in 금액 기준으로 메인 팟 생성
2. 초과분으로 사이드 팟 생성
3. 각 팟은 해당 팟에 기여한 플레이어만 참여

## Variant 1: Texas Hold'em

### 게임 진행
1. **딜러 버튼 배정** (시계 방향 회전)
2. **블라인드 강제 베팅**
   - Small Blind: 딜러 왼쪽 첫 번째
   - Big Blind: 딜러 왼쪽 두 번째
3. **Pre-Flop**: 각 플레이어에게 홀카드 2장 (비공개) → 베팅 라운드
4. **Flop**: 커뮤니티 카드 3장 공개 → 베팅 라운드
5. **Turn**: 커뮤니티 카드 1장 추가 공개 → 베팅 라운드
6. **River**: 커뮤니티 카드 1장 추가 공개 → 베팅 라운드
7. **Showdown**: 남은 플레이어의 핸드 공개, 최적 5장으로 승자 결정

### 핸드 평가
- 홀카드 2장 + 커뮤니티 카드 5장 = 7장에서 최적 5장 선택

### 베팅 순서
- Pre-Flop: UTG(빅 블라인드 왼쪽)부터 시작
- 이후 라운드: 딜러 왼쪽 첫 번째 활성 플레이어부터 시작

## Variant 2: Five Card Draw

### 게임 진행
1. **딜러 버튼 배정**
2. **블라인드 강제 베팅** (Hold'em과 동일)
3. **딜링**: 각 플레이어에게 5장 (비공개)
4. **First Betting Round**: 베팅 라운드
5. **Draw Phase**: 각 플레이어가 0~5장 교환
   - 교환할 카드를 선택하여 버리고, 덱에서 동일 수만큼 새 카드 수령
   - 교환하지 않을 수도 있음 (Stand Pat)
6. **Second Betting Round**: 베팅 라운드
7. **Showdown**: 남은 플레이어의 5장으로 승자 결정

### 핸드 평가
- 보유한 5장 그대로 평가

### Draw 규칙
- 최소 0장, 최대 5장 교환 가능
- 덱에 카드가 부족한 경우 버린 카드를 셔플하여 재사용

## Variant 3: Seven Card Stud

### 게임 진행
1. **Ante**: 모든 플레이어가 ante 지불
2. **Third Street**: 각 플레이어에게 3장 (2장 비공개 + 1장 공개)
   - 가장 낮은 공개 카드의 플레이어가 bring-in (강제 베팅)
   - 베팅 라운드
3. **Fourth Street**: 각 플레이어에게 1장 추가 공개
   - 가장 높은 공개 카드의 플레이어부터 시작
   - 베팅 라운드
4. **Fifth Street**: 각 플레이어에게 1장 추가 공개
   - 베팅 라운드
5. **Sixth Street**: 각 플레이어에게 1장 추가 공개
   - 베팅 라운드
6. **Seventh Street (River)**: 각 플레이어에게 1장 추가 비공개
   - 베팅 라운드
7. **Showdown**: 7장에서 최적 5장으로 승자 결정

### 핸드 평가
- 7장 (4장 공개 + 3장 비공개) 에서 최적 5장 선택

### 특수 규칙
- 블라인드 대신 ante 사용
- Bring-in: Third Street에서 가장 낮은 공개 카드 보유자의 강제 베팅
- 같은 공개 카드일 경우 무늬로 결정 (♣ < ♦ < ♥ < ♠)
- 베팅 순서: 공개 카드 기준 (Fourth Street부터는 가장 높은 핸드부터)

### 카드 부족 대응
- 7명 기준 최대 49장 필요 (7*7). 6명 이하이므로 42장 = 문제 없음
- 만약 부족 시: 마지막 카드를 커뮤니티 카드로 공개

## IPokerEngine Interface

```typescript
interface IPokerEngine {
  readonly variant: PokerVariant;

  initialize(players: PlayerSeat[], mode: IGameMode): GameState;
  startHand(state: GameState): GameState;
  handleAction(state: GameState, playerUuid: string, action: PlayerAction): GameState;
  getValidActions(state: GameState, playerUuid: string): PlayerAction[];
  isHandComplete(state: GameState): boolean;
  resolveHand(state: GameState): HandResult;
}
```

## Phase Machines

### Texas Hold'em
```
DEAL → PRE_FLOP → FLOP → TURN → RIVER → SHOWDOWN
```

### Five Card Draw
```
DEAL → FIRST_BET → DRAW → SECOND_BET → SHOWDOWN
```

### Seven Card Stud
```
ANTE → THIRD_STREET → FOURTH_STREET → FIFTH_STREET → SIXTH_STREET → SEVENTH_STREET → SHOWDOWN
```
