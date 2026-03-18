# 플레이 화면 - 게임 룰 표시

## 개요
플레이 화면 우측 사이드바에 현재 방에 적용된 게임 룰(설정)을 표시한다.

## 표시 정보
| 항목 | 설명 | 조건 |
|------|------|------|
| 게임 종류 | Texas Hold'em / 5 Card Draw / 7 Card Stud | 항상 |
| 게임 모드 | Tournament / Cash Game | 항상 |
| Small Blind / Big Blind | 블라인드 금액 | 항상 |
| 시작 칩 | 시작 시 지급되는 칩 수량 | 항상 |
| 앤티(Ante) | 앤티 금액 | Seven Card Stud 전용 |
| 블라인드 스케줄 | 레벨별 블라인드 상승 정보 | Tournament 전용 |

## 위치
- 우측 사이드바 상단 (PlayerList 위)
- 사이드바 너비: 320px (기존 유지)

## 데이터 흐름
1. 백엔드 `getRoomState()`는 이미 `settings: RoomSettings` 를 응답에 포함
2. 프론트엔드 `RoomState` 타입에 `settings` 필드 추가
3. 프론트엔드에 `BlindLevel`, `RoomSettings` 타입 추가
4. 새로운 `GameRulesPanel` 컴포넌트에서 `currentRoom`의 정보를 표시

## 디자인
- 다른 사이드바 컴포넌트(PlayerList, BettingControls)와 일관된 스타일
- `bg-gray-800 rounded-lg p-3` 카드 스타일
- 항목은 라벨(회색) + 값(흰색) 형태의 2열 레이아웃
- 블라인드 스케줄은 접이식(collapsible)으로 표시하여 공간 절약

## 변경 파일
- `frontend/src/lib/types.ts` - `BlindLevel`, `RoomSettings` 타입 추가, `RoomState`에 `settings` 필드 추가
- `frontend/src/components/game/sidebar/GameRulesPanel.tsx` - 새 컴포넌트
- `frontend/src/components/game/sidebar/GameRulesPanel.test.tsx` - 테스트
- `frontend/app/game/[roomId]/page.tsx` - 사이드바에 GameRulesPanel 추가
