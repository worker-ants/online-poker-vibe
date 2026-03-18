## 보안 코드 리뷰 결과

---

### 발견사항

---

**[WARNING]** `action.amount`에 대한 숫자 유효성 검증 누락
- 위치: `backend/src/game/engine/betting-round.ts` - `raise` case
- 상세: `action.amount`가 클라이언트(WebSocket)로부터 전달되는데, `NaN`, `Infinity`, 음수에 대한 검증이 없음.
  - `NaN` 입력 시: `NaN > player.chips` → `false`, `NaN < currentBet + minRaise` → `false` (NaN 비교는 항상 false) → `player.chips -= NaN` → chips가 `NaN`으로 오염됨
  - 음수 입력 시: 두 번째 조건(`totalBet < currentBet + minRaise`)이 일반적으로 방어하지만, `minRaise`가 0인 엣지 케이스에서 음수가 통과할 가능성 있음
- 제안:
  ```typescript
  case 'raise': {
    const raiseAmount = action.amount;
    if (raiseAmount === undefined || !Number.isFinite(raiseAmount) || raiseAmount <= 0) {
      throw new Error('유효하지 않은 레이즈 금액입니다.');
    }
  ```

---

**[WARNING]** HTTP 기본값으로 인한 평문 전송 위험
- 위치: `frontend/src/lib/constants.ts` - `BACKEND_URL`
- 상세: `NEXT_PUBLIC_BACKEND_URL` 환경변수가 설정되지 않을 경우 `http://localhost:3000`으로 폴백. 프로덕션 환경에서 환경변수 미설정 시 WebSocket 연결 및 쿠키 전송이 평문 HTTP로 이루어져 MITM(중간자 공격) 위험이 존재
- 제안: 프로덕션 빌드 시 환경변수 미설정을 CI/CD 단계에서 검증하거나, 기본값을 제거하고 필수값으로 강제

---

**[WARNING]** CSRF 보호 미적용
- 위치: `backend/src/player/`, `backend/src/hall-of-fame/` 등 HTTP 엔드포인트
- 상세: `player_uuid` 쿠키 기반 인증을 사용하면서 CSRF 토큰 검증이 보이지 않음. `/player/me` 등 GET 엔드포인트는 무해하지만, 상태 변경 엔드포인트가 쿠키만으로 인증할 경우 CSRF 취약. WebSocket은 별도의 handshake 과정이 있어 상대적으로 낮은 위험
- 제안: NestJS의 `csurf` 미들웨어 또는 `SameSite=Strict` 쿠키 속성 적용 확인 필요 (현재 코드에서 쿠키 설정 옵션 미확인)

---

**[WARNING]** 쿠키 보안 속성 미확인
- 위치: `backend/src/player/` (player_uuid 쿠키 설정 코드, 이번 리뷰 범위 외)
- 상세: `player_uuid` 쿠키가 `HttpOnly`, `Secure`, `SameSite` 속성 없이 설정되면 JavaScript에서 탈취 가능하고 평문 전송될 수 있음. `socket.ts`에서 `withCredentials: true`로 쿠키 전송 중
- 제안: 쿠키 설정 시 반드시 `httpOnly: true`, `secure: true` (프로덕션), `sameSite: 'strict'` 적용

---

**[INFO]** WebSocket 액션에 대한 레이트 리미팅 미적용
- 위치: `backend/src/game/` - game:action 핸들러
- 상세: 플레이어가 게임 액션(베팅 등)을 극단적으로 빠르게 반복 전송할 경우 서버 처리 부하 및 게임 로직 오작동 가능성. 현재 코드에서 레이트 리미팅 로직 미확인
- 제안: `@nestjs/throttler` 또는 WebSocket 미들웨어에서 클라이언트별 액션 빈도 제한

---

**[INFO]** 에러 메시지에 내부 로직 노출
- 위치: `backend/src/game/engine/betting-round.ts:195`
- 상세: `throw new Error(`알 수 없는 액션: ${action.type}`)` - 클라이언트에 전달될 경우 내부 액션 타입 열거 가능. 직접적 위험은 낮지만 정보 노출에 해당
- 제안: 클라이언트 전달 에러와 내부 로깅 에러를 분리

---

**[INFO]** 클라이언트 측 베팅 금액 검증 우회 가능
- 위치: `frontend/src/components/game/sidebar/BettingControls.tsx`
- 상세: `<input type="number">` 의 `min`/`max` 속성은 브라우저 UI 제약일 뿐, 개발자 도구로 우회 가능. 서버 측 검증에 의존해야 함. 서버의 `betting-round.ts`에서 최소/최대 범위 검증이 이루어지므로 현재는 적절하나, 앞서 언급한 NaN 취약점과 결합 시 문제
- 제안: 프론트엔드 폼 제출 전 `Number.isFinite()` 및 범위 검증 추가

---

**[INFO]** AI 플레이어 UUID 위조 가능성 검토 필요
- 위치: `backend/src/ai/ai-names.ts` - `AI_UUID_PREFIX = 'ai-player-'`
- 상세: `isAiPlayer(uuid)` 함수가 UUID 접두사만으로 AI 여부 판단. UUID가 서버에서 생성되고 클라이언트가 직접 설정 불가하다면 문제없으나, 만약 어떤 경로로든 `ai-player-*` 형태의 UUID를 갖는 플레이어가 생성된다면 AI로 취급될 수 있음
- 제안: 별도의 `isAI: boolean` 플래그를 DB에 저장하여 UUID 접두사 의존도 감소

---

### 요약

전반적으로 React의 기본 XSS 방어, 암호학적으로 안전한 셔플(`crypto.randomInt`), 적절한 서버 측 액션 권한 검증 등 기본 보안 원칙은 잘 지켜지고 있습니다. 그러나 WebSocket으로 전달되는 `action.amount`에 대한 `NaN`/`Infinity` 검증 부재가 게임 상태 오염으로 이어질 수 있는 가장 실질적인 취약점이며, 프로덕션 환경에서 HTTPS 강제 및 쿠키 보안 속성 적용 여부 확인이 필요합니다. CSRF 보호와 WebSocket 레이트 리미팅도 프로덕션 배포 전 반드시 검토되어야 합니다.

---

### 위험도

**MEDIUM**