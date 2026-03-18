## 보안 코드 리뷰

### 발견사항

---

**[WARNING] Next.js Rewrite에서 하드코딩된 백엔드 URL**
- 위치: `frontend/next.config.ts`
- 상세: `destination: 'http://localhost:3000/:path*'` — 프로덕션에서도 localhost를 가리키는 하드코딩된 URL. 환경변수로 분리되지 않아 배포 환경에서 잘못된 설정으로 인한 의도치 않은 요청 라우팅 가능.
- 제안: `process.env.BACKEND_INTERNAL_URL ?? 'http://localhost:3000'` 형태로 환경변수 사용

---

**[WARNING] 서버 에러 응답 시 에러 정보 클라이언트 전달**
- 위치: `frontend/app/hall-of-fame/page.tsx:35`, `frontend/app/page.tsx:44`
- 상세: `catch` 블록에서 에러를 단순히 무시하거나, `response.error`를 Toast로 직접 노출. 백엔드가 내부 에러 메시지(스택 트레이스, DB 에러 등)를 그대로 반환하는 경우 클라이언트에 노출됨.
- 제안: 서버 에러는 사용자 친화적인 일반 메시지로 대체하고, 원본 에러는 로깅으로만 처리

---

**[WARNING] UUID 경로 파라미터 검증 없이 직접 API 요청**
- 위치: `frontend/app/hall-of-fame/page.tsx:44`
- 상세: `handlePlayerClick(uuid: string)` — `uuid` 값을 검증 없이 URL 경로에 삽입: `` `${BACKEND_URL}/hall-of-fame/${uuid}/history` ``. 백엔드에서 검증이 이루어져야 하지만, 프론트엔드에서도 UUID 형식 검증이 있으면 의도치 않은 요청 감소.
- 제안: UUID 형식 정규식 검증 후 API 호출

---

**[WARNING] `data: any` 타입 사용**
- 위치: `frontend/app/page.tsx:50`
- 상세: `handleCreate = (data: any)` — `any` 타입으로 CreateRoomModal에서 받은 데이터를 검증 없이 소켓으로 전송. 타입 안전성이 없어 예상치 못한 데이터가 서버로 전달될 수 있음.
- 제안: 명시적 타입 인터페이스 정의 (사실 `CreateRoomModal`의 `onCreate` prop에 이미 타입이 정의되어 있으므로 `any` 제거)

---

**[WARNING] BettingControls — 클라이언트 측 베팅 금액 제한만 존재**
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx:57`
- 상세: `<input type="number" min={minRaise} max={maxRaise}>` — HTML 속성의 min/max는 브라우저 UI 힌트에 불과. 사용자가 DevTools나 직접 소켓 메시지로 범위 밖의 금액을 보낼 수 있음. 현재 스펙에 따르면 서버에서 검증하도록 설계되어 있으나, 실제 백엔드 구현 시 반드시 서버 측 검증 확인 필요.
- 제안: (백엔드) `game:action` 핸들러에서 `amount`의 min/max 검증 필수

---

**[INFO] Socket.IO 싱글톤 패턴 — 모듈 수준 전역 변수**
- 위치: `frontend/src/lib/socket.ts:5`
- 상세: `let socket: Socket | null = null` — 모듈 수준 전역 변수. Next.js SSR 환경에서는 서버 사이드 렌더링 시 의도치 않게 실행될 수 있으나, `'use client'` 지시어가 있어 이 파일은 클라이언트에서만 실행됨. 그러나 소켓 연결 해제 후 재접속 시 이전 이벤트 리스너가 남아있을 가능성 확인 필요.
- 제안: `disconnectSocket` 호출 시 모든 이벤트 리스너를 명시적으로 제거 (`socket.removeAllListeners()`)

---

**[INFO] BACKEND_URL 환경변수 미설정 시 localhost 폴백**
- 위치: `frontend/src/lib/constants.ts:27`
- 상세: `process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'` — 환경변수 미설정 시 localhost로 폴백. 프로덕션 배포에서 `.env` 미설정 시 의도치 않게 localhost로 연결 시도.
- 제안: 프로덕션 빌드 시 환경변수 필수 설정 강제 (빌드 스크립트 또는 Next.js config에서 확인)

---

**[INFO] 닉네임 클라이언트 측 길이 제한만 존재**
- 위치: `frontend/src/components/lobby/NicknameInput.tsx:54`
- 상세: `maxLength={20}` — HTML 속성으로만 길이 제한. 서버 측(identity:set-nickname 핸들러)에서도 동일한 제한을 검증해야 함.
- 제안: (백엔드) `class-validator`로 `@MaxLength(20)`, `@MinLength(2)` 검증 필수

---

### 요약

프론트엔드 코드는 전반적으로 보안 설계 원칙(서버 신뢰, 비공개 카드 서버 관리, httpOnly 쿠키 인증)을 잘 따르고 있습니다. 클라이언트는 게임 상태를 서버로부터 수신하는 방식으로 설계되어 카드 정보 노출 위험이 낮습니다. 주요 우려사항은 하드코딩된 백엔드 URL, `any` 타입 사용으로 인한 타입 안전성 부재, 그리고 클라이언트 측 입력 검증(닉네임 길이, 베팅 금액)이 UI 힌트에 그치므로 백엔드에서 반드시 동일한 검증이 이루어져야 한다는 점입니다. 에러 메시지의 직접 노출도 서버 에러 정보 유출로 이어질 수 있으므로 주의가 필요합니다.

### 위험도

**LOW** (프론트엔드 단독 기준) — 비즈니스 로직이 모두 서버에 있고, 클라이언트 설계가 적절하나 백엔드 검증 구현 여부에 따라 전체 위험도가 결정됨