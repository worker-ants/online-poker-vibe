# 08. Hall of Fame (명예의 전당)

## Overview

플레이어 순위 및 게임 전적 조회 시스템을 정의합니다.

## 순위 표시 항목

| 항목 | 설명 | 표시 형식 |
|------|------|----------|
| 순위 | 랭킹 순번 | 1, 2, 3, ... |
| 닉네임 | 플레이어 닉네임 | 문자열 |
| 승리 | 승리한 게임 수 | 정수 |
| 무승부 | Split pot 발생 횟수 | 정수 |
| 패배 | 패배한 게임 수 | 정수 |
| 이탈 | 게임 중 중도 이탈 수 | 정수 |
| 승률 | 승리 / 전체 게임 수 | 소수점 2자리 (예: 65.38%) |
| 마지막 게임 | 마지막 게임 종료 시간 | YYYY-MM-DD HH:mm:ss |

## 순위 기준 (우선순위)

1. **승률** (wins / totalGames) — 높을수록 상위
   - totalGames = wins + draws + losses + abandonments
   - abandonments는 패배로 간주하므로 승률에 불리하게 작용
2. **승리 수** — 많을수록 상위
3. **총 게임 수** — 많을수록 상위 (경험치 반영)
4. **최근 게임 시간** — 최근일수록 상위 (활동성 반영)

### 기존 요구사항 대비 변경점
- 기존: 비김 수 → **삭제** (비김은 포커에서 드물어 의미 있는 차별 요소 아님)
- 기존: 패배 수 적을수록 → **총 게임 수 많을수록** (경험 반영이 더 의미 있음)
- 기존: 마지막 게임이 빠를수록 → **최근일수록** (직관적 - 최근 활동 플레이어 우대)
- **추가**: 승률을 1순위로 (승리 수만으로는 많이 플레이한 사람이 유리)

## 조회 API

### REST: GET /hall-of-fame
쿼리 파라미터:
- `page`: 페이지 번호 (기본: 1)
- `limit`: 페이지당 항목 수 (기본: 20, 최대: 100)

응답:
```json
{
  "data": [
    {
      "rank": 1,
      "nickname": "PokerKing",
      "wins": 42,
      "draws": 3,
      "losses": 15,
      "abandonments": 2,
      "winRate": 67.74,
      "totalGames": 62,
      "lastGameTime": "2026-03-18 14:30:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### REST: GET /hall-of-fame/:playerUuid/history
플레이어의 전체 게임 전적 조회.

응답:
```json
{
  "nickname": "PokerKing",
  "games": [
    {
      "gameId": "uuid",
      "variant": "texas-holdem",
      "mode": "tournament",
      "gameTime": "2026-03-18 14:30:00",
      "result": "win",
      "players": [
        { "nickname": "PokerKing", "placement": 1 },
        { "nickname": "CardShark", "placement": 2 },
        { "nickname": "BluffMaster", "placement": 3 }
      ]
    }
  ]
}
```

## 순위 집계 쿼리

```sql
SELECT
  p.uuid,
  p.nickname,
  COUNT(*) AS totalGames,
  SUM(CASE WHEN gp.result = 'win' THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN gp.result = 'draw' THEN 1 ELSE 0 END) AS draws,
  SUM(CASE WHEN gp.result = 'loss' THEN 1 ELSE 0 END) AS losses,
  SUM(CASE WHEN gp.result = 'abandoned' THEN 1 ELSE 0 END) AS abandonments,
  ROUND(
    CAST(SUM(CASE WHEN gp.result = 'win' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100,
    2
  ) AS winRate,
  MAX(g.finishedAt) AS lastGameTime
FROM game_participant gp
JOIN player p ON gp.playerUuid = p.uuid
JOIN game g ON gp.gameId = g.id
WHERE g.status IN ('completed', 'abandoned')
GROUP BY p.uuid
HAVING COUNT(*) > 0
ORDER BY
  winRate DESC,
  wins DESC,
  totalGames DESC,
  lastGameTime DESC
```

## 게임 기록 보존 정책

- 완료(`completed`) 또는 이탈(`abandoned`) 상태의 게임 기록(Game, GameParticipant)은 방이 삭제되어도 보존
- Game 엔티티의 `roomId`는 nullable이며, 방 삭제 시 `SET NULL`로 처리
- 방 정리 시 진행 중(`in-progress`) 게임만 삭제 (`deleteInProgressGamesByRoom`)
- AI 플레이어는 GameParticipant 레코드를 생성하지 않으므로 순위에 포함되지 않으나, AI와 함께 플레이한 인간 플레이어의 기록은 정상적으로 보존

## 전적 상세 모달

목록에서 플레이어를 클릭하면 modal로 표시:
- 각 게임의 시간
- 게임 변형 (Texas Hold'em / 5 Card Draw / 7 Card Stud)
- 게임 모드 (Tournament / Cash)
- 같이 플레이한 플레이어 목록
- 각 플레이어의 순위(placement) 또는 결과
- 자신의 결과 (win/loss/draw/abandoned)
