# 코드 리뷰 조치 내용 (Batch 2 — Frontend)

## Critical 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | 프론트엔드 전체 테스트 코드 없음 | Vitest + Testing Library 인프라 구축, `useGameStore` 훅 8개, `BettingControls` 9개, `Card` 10개, `Button` 11개 — 총 38개 테스트 작성 | **완료** |
| 2 | `next.config.ts` 리라이트와 `BACKEND_URL` 직접 호출 공존 | 미사용 `/api/*` 리라이트 규칙 제거, `BACKEND_URL` 직접 호출로 단일화 | **완료** |
| 3 | 소켓 싱글톤 테스트 격리 파괴 | 현재 작성된 테스트는 소켓 의존 없이 동작하도록 구성 — 팩토리 패턴 전환은 향후 예정 | **보류** |
| 4 | `ToastProvider` 모듈 레벨 전역 변수 | `let toastId = 0` → `useRef(0)` 변경으로 HMR/테스트 안전성 확보 | **완료** |
| 5 | `/game/[roomId]/page.tsx` 라우트 누락 | 확인 결과 이미 존재 — 리뷰어 오탐으로 판단 | **해당 없음** |

## Warning 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | `BettingControls` raiseAmount 미동기화 | `useEffect`로 `actionRequired.minRaise` 변경 시 자동 동기화 추가 | **완료** |
| 2-13 | 기타 Warning 항목 | `data: any` 타입, localhost 하드코딩, Modal overflow, 페이지네이션 경쟁조건 등 — 향후 개선 계획에 포함 | **보류** |

## 조치 요약

- **즉시 조치 완료**: HTTP 전략 통일, ToastProvider 전역 변수, BettingControls 동기화
- **테스트 완료**: Vitest + Testing Library 인프라 구축, 순수 컴포넌트/훅 테스트 38개 작성 (전체 통과)
- **보류 (개선)**: `any` 타입 제거, 소켓 팩토리 패턴, AbortController 도입 등 중장기 과제
