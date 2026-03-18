# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - fetch 실패 시 소켓 연결이 완전히 차단되는 구조적 문제와 race condition이 핵심 이슈

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `init()` fetch 실패 케이스 및 race condition 시나리오에 대한 테스트 없음 | `SocketProvider.tsx:28`, `useEffect` 전체 | fetch 실패 경로 및 cleanup vs async init 타이밍 시나리오 테스트 작성 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 에러 처리 | `fetch` 실패(네트워크 오류, 5xx 등) 시 uncaught rejection으로 소켓 연결 전체 차단 — "서버에 연결 중..." 재발 가능 | `SocketProvider.tsx:28` | `try/catch`로 감싸고, 실패 시에도 소켓 연결 시도 또는 에러 상태 Context 노출 |
| 2 | Concurrency | `cancelled = true` 후 `disconnectSocket()` 호출 타이밍과 `init()`의 fetch 완료 시점이 겹칠 경우 소켓 이중 생성 또는 `s.connect()`가 cleanup 이후에 실행되는 race condition | cleanup 함수 전체 | `socketRef`로 소켓 참조 보관 후 cleanup에서 직접 disconnect; `s.connect()` 이후에도 `cancelled` 재확인 |
| 3 | 이벤트 리스너 | `disconnectSocket()` 시 `s.off()` 미호출로 이벤트 리스너 누수 가능 (getSocket이 싱글톤인 경우 재마운트 시 중복 등록) | `SocketProvider.tsx:38-41` | cleanup 시 `s.off('connect')`, `s.off('disconnect')` 명시적 제거 |
| 4 | API 계약 | `GET /player/me`가 쿠키 생성이라는 상태 변경 사이드 이펙트를 가짐 — HTTP safe/idempotent 원칙 위반 | `SocketProvider.tsx:29` | 쿠키 발급 전용 `POST /player/session` 분리 또는 미들웨어 레벨 처리 권장 |
| 5 | 아키텍처 | `SocketProvider`가 플레이어 UUID 초기화 책임까지 겸임 — SRP 위반, Provider 의존 순서가 코드 외부에 암묵적으로 존재 | `SocketProvider.tsx` 전체 | `PlayerInitProvider` 또는 `usePlayerInit` 훅 분리; `isReady` 상태로 의존 관계 명시화 |
| 6 | 성능 | 쿠키가 이미 존재해도 매 마운트마다 `/player/me` HTTP 요청 발생 — 소켓 연결 지연 | `init()` 내 `await fetch(...)` | `document.cookie`에서 `player_uuid` 존재 여부 확인 후 조건부 fetch |
| 7 | Testing | 기존 `SocketProvider` 테스트가 비동기 전환 후 `waitFor` 없이 즉시 assert하면 false negative 발생 가능 | `SocketProvider.test.tsx` | 소켓 상태 assert를 `await waitFor(() => ...)` 패턴으로 래핑 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `SocketProvider` JSDoc 없음; `cancelled` 플래그 목적 및 HTTP 선행 요청 이유 미기록 | `SocketProvider.tsx:20` | 컴포넌트 설계 의도 JSDoc 추가 |
| 2 | 문서화 | 인라인 주석 "쿠키를 먼저 생성" 표현 부정확 (서버가 설정하는 것) | `SocketProvider.tsx:28` | `// /player/me 호출로 서버가 player_uuid 쿠키를 설정하게 한 뒤 소켓 연결` |
| 3 | 유지보수성 | 지역 변수명 `s`가 불명확 (컨텍스트 변수 `socket`과 불일치) | `init()` 내 `const s = getSocket()` | `const socket = getSocket()`으로 변경 |
| 4 | 유지보수성 | `/player/me` 경로 문자열 하드코딩 | `init()` 내 fetch URL | `constants.ts`에 `PLAYER_ME_ENDPOINT` 상수 추가 |
| 5 | 보안 | `credentials: 'include'` 사용 시 백엔드 CORS 설정 전제 의존 (`Access-Control-Allow-Origin` 명시적 origin, `credentials: true` 필수) | `SocketProvider.tsx:29` | 백엔드 CORS 설정 일관성 검증 |
| 6 | 설정 | `BACKEND_URL` 환경변수 설정 방법 미문서화 | `constants.ts` | `.env.example`에 `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001` 추가 |
| 7 | Testing | `credentials: 'include'` 옵션이 실제로 전달되는지 assert하는 테스트 없음 | `SocketProvider.tsx:29` | `expect(global.fetch).toHaveBeenCalledWith(..., { credentials: 'include' })` |
| 8 | Testing | 테스트 환경에서 `BACKEND_URL`이 잘못된 값일 경우 실제 네트워크 호출 가능 | `constants.ts` mock | jest mock 또는 msw 인터셉터 설정 |
| 9 | Concurrency | `setSocket(s)` 후 이벤트 리스너 등록 순서로 인해 소켓이 Context 노출 시점에 리스너 미등록 상태 존재 | `init()` 내 순서 | 리스너 등록 → `connect()` → `setSocket(s)` 순으로 변경 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| performance | HIGH | fetch 실패 시 소켓 연결 완전 차단; 매 마운트마다 불필요한 HTTP 요청 |
| testing | HIGH | fetch 실패 및 race condition 테스트 전무; 비동기 전환 후 기존 테스트 호환성 미검증 |
| concurrency | MEDIUM | cancelled 플래그와 disconnectSocket 간 race condition; 리스너 중복 등록 가능성 |
| requirement | MEDIUM | fetch 실패 시 소켓 연결 중단; 이벤트 리스너 누수; late connect 시나리오 미처리 |
| dependency | MEDIUM | fetch가 소켓 연결의 단일 실패 지점으로 작용 |
| side_effect | MEDIUM | fetch 실패 시 무음 처리; cleanup 경쟁 조건으로 소켓 리소스 누수 가능 |
| api_contract | LOW | GET /player/me의 상태 변경 사이드 이펙트; fetch 에러 핸들링 부재 |
| architecture | LOW | SocketProvider의 SRP 위반; Provider 간 암묵적 의존 순서 |
| security | LOW | fetch 오류 처리 부재; CORS 정책 의존도 |
| documentation | LOW | 설계 의도 문서화 부족; 인라인 주석 부정확 |
| maintainability | LOW | fetch 오류 처리 누락; 변수명 축약; 경로 하드코딩 |
| scope | LOW | fetch 실패 에러 처리 누락으로 인한 불완전한 수정 |
| database | NONE | 해당 없음 |

## 발견 없는 에이전트

- **database** — 변경 파일이 데이터베이스와 무관

## 권장 조치사항

1. **[즉시] `fetch` 실패 에러 처리 추가** — `try/catch`로 감싸고 실패 시에도 소켓 연결 시도 또는 명확한 에러 상태 노출 (재발 방지 핵심)
2. **[즉시] race condition 보완** — `socketRef`로 소켓 참조 보관, cleanup에서 직접 disconnect; `s.connect()` 이후 `cancelled` 재확인 추가
3. **[즉시] 이벤트 리스너 정리** — cleanup 시 `s.off('connect')`, `s.off('disconnect')` 명시적 호출
4. **[단기] 테스트 보완** — fetch 실패 경로, race condition 시나리오, `credentials: 'include'` 검증, `waitFor` 패턴 적용
5. **[단기] 변수명 및 주석 개선** — `s` → `socket`, 인라인 주석 정확도 수정, JSDoc 추가
6. **[중기] 아키텍처 개선 검토** — `PlayerInitProvider` 분리로 SocketProvider SRP 준수; `POST /player/session` 엔드포인트 분리 고려
7. **[중기] 성능 최적화** — 쿠키 존재 여부 확인 후 조건부 fetch로 불필요한 HTTP 왕복 제거