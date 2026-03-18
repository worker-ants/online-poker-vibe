## 의존성 코드 리뷰

### 발견사항

---

**[WARNING]** `socket.io-client`, `zustand` 버전 범위가 고정되지 않음
- 위치: `frontend/package.json` L13-14
- 상세: `^4.8.3`, `^5.0.12` 모두 캐럿(`^`) 범위를 사용하여 마이너 버전 자동 업데이트 허용. 특히 zustand v5는 v4 대비 대규모 breaking change가 있었던 이력이 있어 향후 v5.x에서도 비호환 변경이 발생할 수 있음.
- 제안: 프로덕션 안정성을 위해 `"socket.io-client": "4.8.3"`, `"zustand": "5.0.12"` 정확한 버전으로 고정

---

**[WARNING]** `BACKEND_URL` 폴백이 `localhost`로 하드코딩됨
- 위치: `frontend/src/lib/constants.ts` L27
- 상세: `process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'`는 환경변수 미설정 시 로컬호스트로 연결. 배포 환경에서 환경변수를 누락하면 프로덕션 클라이언트가 localhost에 연결을 시도하며 조용히 실패함.
- 제안: 폴백 제거하고 런타임에 환경변수 미설정 시 에러를 명시적으로 throw:
  ```ts
  export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL
    ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : (() => { throw new Error('NEXT_PUBLIC_BACKEND_URL is required'); })());
  ```

---

**[WARNING]** `/api` 프록시 설정과 직접 `BACKEND_URL` 사용 간 불일치
- 위치: `frontend/next.config.ts` (rewrite), `frontend/app/hall-of-fame/page.tsx` L28-31
- 상세: `next.config.ts`에서 `/api/:path*` → `http://localhost:3000/:path*` 리라이트를 설정했지만, hall-of-fame 페이지는 `BACKEND_URL`을 직접 사용하여 `/hall-of-fame?...`로 요청함. REST 요청이 프록시를 통하지 않으므로 CORS 설정이 따로 필요하고, `/api` 리라이트 자체가 사용되지 않는 중복 설정이 됨.
- 제안: 일관성을 위해 REST 요청도 `/api/hall-of-fame?...` 형태로 Next.js 프록시를 통하거나, `next.config.ts`의 rewrite를 제거하고 모두 `BACKEND_URL` 직접 호출로 통일

---

**[WARNING]** 모듈 수준 싱글톤 패턴이 Next.js SSR과 충돌 가능성 있음
- 위치: `frontend/src/lib/socket.ts` L5
- 상세: `let socket: Socket | null = null`은 모듈 수준 전역 변수. `'use client'` 지시어가 있으나 Next.js App Router 환경에서 Server Component에서 import될 경우 서버 사이드에서 socket 인스턴스를 초기화 시도할 수 있음. 현재 `SocketProvider`만 이를 사용하고 있어 직접적인 문제는 없지만 향후 오용 가능성이 있음.
- 제안: `'use client'` 환경에서만 사용됨을 보장하는 런타임 가드 추가 또는 주석으로 용도 제한 명시

---

**[INFO]** `debug`, `ms` 패키지가 devDependency에서 일반 dependency로 승격
- 위치: `frontend/package-lock.json` L2734, L4969
- 상세: `socket.io-client`가 `debug ~4.4.1`을 런타임 의존성으로 요구하므로 lock 파일에서 정상적으로 승격됨. 예상된 동작.

---

**[INFO]** `ws`, `xmlhttprequest-ssl` 브라우저 환경에서 번들에 포함
- 위치: `package-lock.json` L6602, L6633
- 상세: `engine.io-client`의 전이적 의존성으로 포함된 `ws`(Node.js WebSocket)와 `xmlhttprequest-ssl`은 브라우저 환경에서 실제 사용되지 않음. Next.js 번들러가 tree-shaking하지만 완전히 제거되지 않을 수 있음. 브라우저는 native WebSocket을 사용하므로 기능상 문제는 없음.

---

**[INFO]** `zustand` v5 peer dependency 호환성 확인됨
- 위치: `package-lock.json` zustand 항목
- 상세: zustand v5가 요구하는 `react: >=18.0.0`을 프로젝트의 React 19.2.3이 충족. `@types/react: >=18.0.0`도 선택적 peer dependency로 설정되어 있어 정상.

---

**[INFO]** 모든 신규 의존성 MIT 라이선스 확인됨
- `socket.io-client`: MIT
- `zustand`: MIT
- `@socket.io/component-emitter`: MIT
- `engine.io-client`, `engine.io-parser`: MIT
- `socket.io-parser`: MIT
- `ws`: MIT
- `xmlhttprequest-ssl`: MIT

---

**[INFO]** `useGameStore.ts`의 `'use client'` 지시어는 불필요하지만 무해함
- 위치: `frontend/src/hooks/useGameStore.ts` L1
- 상세: Zustand store 파일 자체는 React 컴포넌트가 아니므로 `'use client'` 지시어가 필수는 아님. 다만 이 파일을 import하는 모든 곳이 클라이언트 컴포넌트이므로 실질적인 문제는 없음.

---

### 요약

의존성 선택 자체는 적절합니다. `socket.io-client`는 백엔드 Socket.IO 서버와의 정합성을 위한 자연스러운 선택이며, `zustand`는 가벼운 상태 관리 라이브러리로 번들 크기 영향이 최소화됩니다. 두 라이브러리 모두 MIT 라이선스이며 알려진 보안 취약점이 없습니다. 주요 우려사항은 의존성 자체보다 **설정 레이어**에 있습니다. `BACKEND_URL` 폴백의 암묵적 localhost 연결과 Next.js 프록시 rewrite를 설정해두고 실제로는 직접 `BACKEND_URL`로 요청하는 불일치는 배포 시 혼란을 야기할 수 있습니다. 버전 범위(`^`)를 정확한 버전으로 고정하면 재현 가능한 빌드를 보장할 수 있습니다.

### 위험도

**LOW**