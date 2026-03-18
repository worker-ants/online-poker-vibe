## 보안 코드 리뷰

### 발견사항

---

**[WARNING] 쿠키 기반 인증의 무결성 검증 부재**
- 위치: `backend/src/player/player.controller.ts` L15-52, `backend/src/common/guards/nickname-required.guard.ts`
- 상세: `player_uuid` 쿠키를 서명(signing) 없이 사용. 클라이언트가 임의의 UUID를 쿠키에 설정하여 타인의 계정을 사칭할 수 있음. `cookie-parser`의 서명 기능(`cookieParser(secret)`)을 사용하지 않아 `req.cookies` 대신 `req.signedCookies`를 통한 검증이 불가능함.
- 제안: `cookieParser(process.env.COOKIE_SECRET)` + `signed: true` 쿠키 옵션 사용 후 `req.signedCookies`로 접근

---

**[WARNING] CORS 설정의 와일드카드 위험 - 환경 변수 미설정 시 노출**
- 위치: `backend/src/main.ts` L10-13
- 상세: `FRONTEND_URL` 환경 변수가 설정되지 않으면 `http://localhost:3001`로 폴백. 프로덕션 배포 시 환경 변수 누락으로 인한 잘못된 CORS 허용 가능성. 단일 origin만 허용하지만 credentials와 함께 사용하므로 정확한 origin 관리가 중요.
- 제안: `.env` 파일에 `FRONTEND_URL` 명시적 설정 강제화, 프로덕션에서 환경 변수 미설정 시 서버 시작 거부 로직 추가

---

**[WARNING] TypeORM `synchronize: true` - 프로덕션 위험**
- 위치: `backend/src/database/database.module.ts` L10
- 상세: `synchronize: true`는 개발 편의를 위한 설정으로, 엔티티 변경 시 자동으로 테이블을 수정/삭제함. 프로덕션 환경에서 실수로 사용 시 데이터 손실 위험.
- 제안: `synchronize: process.env.NODE_ENV !== 'production'` 또는 명시적으로 `false`로 설정하고 마이그레이션 사용

---

**[WARNING] WebSocket 인증 미검증 - 게임 액션 조작 가능**
- 위치: `backend/src/room/room.gateway.ts` (diff 생략됨)
- 상세: `room.controller.ts`에서는 쿠키로 UUID를 읽지만, WebSocket 핸들러에서 동일한 검증이 이루어지는지 확인 필요. 특히 `GAME_ACTION` 이벤트 처리 시 `playerUuid`를 클라이언트 전송 데이터에서 가져올 경우 조작 가능.
- 제안: WebSocket 핸들러에서 `client.handshake.headers.cookie` 또는 `client.data`에 저장된 UUID를 사용해야 함. 클라이언트 전송 payload의 UUID를 신뢰하면 안 됨.

---

**[WARNING] 닉네임 유일성 검사 레이스 컨디션**
- 위치: `backend/src/player/player.service.ts` L44-50
- 상세: `findOne({ where: { nickname: trimmed } })` 후 `save()` 사이에 동일 닉네임 동시 요청 시 중복 저장 가능. DB 레벨의 unique constraint(`player.entity.ts`에 존재)가 에러를 던지지만, 이를 적절히 처리하지 않으면 500 에러 노출.
- 제안: DB unique constraint 위반 에러(`SQLITE_CONSTRAINT`)를 catch하여 `BadRequestException`으로 변환하는 에러 핸들링 추가

---

**[WARNING] `Math.random()` 사용 - 암호학적으로 안전하지 않은 셔플**
- 위치: `backend/src/game/engine/deck.ts` L24
- 상세: Fisher-Yates 셔플에 `Math.random()` 사용. 포커 게임의 공정성(fairness)에 영향. 예측 가능한 난수로 카드 순서 예측 공격 이론적으로 가능. 실제 머니 게임이라면 심각하지만 뷰 프로젝트이므로 낮은 위험도.
- 제안: `crypto.getRandomValues()` 또는 Node.js의 `crypto.randomInt()` 사용

---

**[WARNING] 홀 카드(holeCards) 서버 메모리 노출 위험**
- 위치: `backend/src/game/game.service.ts` L173-180
- 상세: `getPrivateStates()`가 모든 플레이어의 홀 카드를 반환. 이 데이터가 WebSocket을 통해 올바른 플레이어에게만 전달되는지 gateway 레벨에서의 검증 필요. 잘못된 emit 타겟 설정 시 모든 플레이어의 카드가 노출됨.
- 제안: Gateway에서 각 플레이어의 소켓 ID와 UUID 매핑을 검증하고, 개인 카드는 반드시 특정 소켓에만 `emit` 할 것

---

**[INFO] `room.controller.ts` 타입 캐스팅 우회**
- 위치: `backend/src/room/room.controller.ts` L18
- 상세: `(req as any).cookies?.player_uuid` - `as any` 캐스팅으로 타입 안전성 우회. 동일 기능을 하는 `@PlayerUuid()` 데코레이터가 존재함에도 사용하지 않음. 불일치는 보안 결함은 아니나 유지보수 시 취약점으로 이어질 수 있음.
- 제안: 이미 구현된 `@PlayerUuid()` 데코레이터 일관 사용

---

**[INFO] 플레이어 UUID 타입 미검증**
- 위치: `backend/src/player/player.controller.ts` L17, 39
- 상세: 쿠키에서 읽은 `uuid`가 실제 UUID 형식인지 검증하지 않음. 유효하지 않은 형식의 값이 DB 쿼리에 그대로 전달됨. SQLite를 사용하므로 SQL injection 위험은 낮으나 예상치 못한 동작 가능.
- 제안: `uuid` 패키지의 `validate()` 함수로 UUID v4 형식 검증 추가

---

**[INFO] `.gitignore`에 `.env` 포함 확인**
- 위치: `.gitignore`
- 상세: `.env` 및 `.env.local`이 gitignore에 포함됨. 양호. 단, `backend/.env`와 `frontend/.env`의 경우 하위 디렉토리 패턴으로도 매칭되는지 확인 필요 (루트 `.gitignore`의 `.env` 패턴은 전체 경로에 적용됨).
- 제안: 현재 설정으로 충분하나 `.env.example` 파일로 필요한 환경 변수 문서화 권장

---

**[INFO] HallOfFame `playerUuid` 파라미터 미검증**
- 위치: `backend/src/hall-of-fame/hall-of-fame.controller.ts` L21
- 상세: URL 경로 파라미터 `playerUuid`를 검증 없이 DB 쿼리에 사용. TypeORM이 파라미터 바인딩을 사용하므로 SQL injection 위험은 없으나, 불필요한 DB 조회 발생 가능.
- 제안: UUID 형식 검증 파이프 추가 (NestJS `ParseUUIDPipe` 사용)

---

### 요약

전반적으로 OWASP Top 10 중 심각한 취약점(SQL Injection, XSS 등)은 TypeORM 파라미터 바인딩과 ValidationPipe 사용으로 잘 방어되어 있습니다. 그러나 **쿠키 기반 인증에 서명이 없어 UUID 위변조가 가능**한 점과, **WebSocket 게임 액션 처리 시 클라이언트 전송 UUID를 신뢰할 경우 게임 액션 조작이 가능**한 점이 핵심 보안 이슈입니다. `synchronize: true` 설정은 프로덕션 데이터 안전성에 위협이 되며, 카드 셔플의 `Math.random()` 사용은 게임 공정성에 영향을 줍니다. 홀 카드의 선택적 전송 로직이 Gateway에서 올바르게 구현되는지 검증이 필요합니다.

### 위험도

**MEDIUM**