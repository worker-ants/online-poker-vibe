파일 쓰기 권한이 필요합니다. 위 통합 보고서를 `review/2026-03-18_16-17-37/SUMMARY.md`에 저장하려고 합니다. 권한을 허용해 주시면 진행하겠습니다.

아래는 작성된 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 테스트 코드 전무(TDD 방침 위반), 두 가지 HTTP 전략 충돌, 다수 에이전트가 공통 지적한 `BettingControls` 상태 버그 및 `any` 타입 사용 복합 발견

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신규 추가 34개 파일 전체에 테스트 코드 없음. CLAUDE.md TDD 방침 위배 | 프론트엔드 전체 | 순수 컴포넌트부터 단위 테스트 시작 |
| 2 | Architecture/API | `next.config.ts` `/api/*` 리라이트와 `BACKEND_URL` 직접 호출 공존. 리라이트 미사용, 프로덕션 CORS 오류 가능 | `next.config.ts`, `constants.ts`, `hall-of-fame/page.tsx` | HTTP 전략 단일화 |
| 3 | Testing/Architecture | 모듈 레벨 소켓 싱글톤이 테스트 격리 파괴, StrictMode/HMR 예측 불가 동작 | `src/lib/socket.ts:5` | Provider 내부에서 소켓 생성 또는 팩토리 주입 |
| 4 | Testing | `let toastId = 0` 모듈 레벨 전역 변수. 테스트 간 상태 공유, HMR 시 ID 충돌 | `ToastProvider.tsx:23` | `useRef` 또는 `crypto.randomUUID()` 사용 |
| 5 | Scope | 게임 컴포넌트 모두 구현되었으나 `/game/[roomId]/page.tsx` 라우트 누락 | `frontend/app/game/[roomId]/` | 게임 페이지 라우트 파일 추가 |

---

## 경고 (WARNING) — 13개

주요 항목: `BettingControls` raiseAmount 미동기화(5개 에이전트 공통), `data: any` 타입(6개 에이전트 공통), localhost URL 하드코딩(6개 에이전트 공통), Modal overflow 경합, 페이지네이션 경쟁 조건, HTTP 상태코드 미검증, `useGameStore` SRP 위반, fetch 레이어 미분리, 소켓 리스너 누적, 재연결 후 identity 미복구, Hall of Fame DB 집계 성능, 히스토리 페이지네이션 없음, 베팅 금액 클라이언트 검증만 존재

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| testing | **HIGH** |
| requirement, database, api_contract, architecture | **MEDIUM** |
| performance, maintainability, security, documentation, side_effect, concurrency, scope, dependency | **LOW** |

---

## 권장 조치 우선순위

1. **[즉시]** 테스트 코드 작성 (TDD 방침 준수)
2. **[즉시]** HTTP 전략 통일 (`next.config.ts` 리라이트 제거 또는 통일)
3. **[즉시]** `/game/[roomId]/page.tsx` 생성
4. **[높음]** `BettingControls` raiseAmount `useEffect` 동기화
5. **[높음]** `handleCreate` `any` 타입 제거
6. **[높음]** 소켓 싱글톤 이벤트 리스너 명시적 제거
7. **[중간]** HTTP 응답 상태코드 검증 + 에러 Toast
8. **[중간]** `AbortController` 도입 (페이지네이션 경쟁 조건 해결)
9. **[중간]** `frontend/.env.example` 생성