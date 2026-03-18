## 의존성 코드 리뷰

### 발견사항

---

- **[WARNING] `PlayerHistoryModal.tsx` - 동일 모듈 중복 import**
  - 위치: 파일 15, 1~5번째 import 라인
  - 상세: `@/src/lib/types`에서 3개의 분리된 import 문이 존재함 (`GameHistoryEntry`, `VARIANT_LABELS/MODE_LABELS`, `PokerVariant/GameMode`). 또한 `game.variant as PokerVariant`, `game.mode as GameMode` 타입 단언이 필요한 것은 `GameHistoryEntry` 인터페이스가 `variant: string`, `mode: string`으로 정의되어 있어 타입 시스템 불일치를 나타냄.
  - 제안: import를 하나로 통합하고, `GameHistoryEntry`의 `variant`, `mode` 필드를 `PokerVariant`, `GameMode` 타입으로 변경하여 타입 단언 제거

---

- **[WARNING] `database.module.ts` - ESM 컨텍스트에서의 `__dirname` 사용**
  - 위치: 파일 46, `join(__dirname, ...)` 라인
  - 상세: 백엔드 코드 전반이 `.js` 확장자 import 패턴(`import ... from './ai-player.service.js'`)을 사용하여 ESM 모드임을 시사하지만, `__dirname`은 CommonJS 전용 전역 변수임. ESM에서는 `import.meta.url`과 `fileURLToPath`를 사용해야 함.
  - 제안: `import { fileURLToPath } from 'url'; import { dirname } from 'path'; const __dirname = dirname(fileURLToPath(import.meta.url));` 로 대체하거나, `tsconfig.json`에서 `module` 설정을 확인하여 일관성 유지

---

- **[INFO] `ai-player.service.spec.ts` - 백엔드/프론트엔드 테스트 프레임워크 혼용**
  - 위치: 파일 37, `jest.spyOn(Math, 'random')`, `jest.restoreAllMocks()` 사용 부분
  - 상세: 프론트엔드는 Vitest(`vi.spyOn`, `vi.fn()`)를 사용하고, 백엔드는 Jest(`jest.spyOn`)를 사용함. 모노레포 내 두 가지 테스트 프레임워크 공존은 의도적 설계이나, 개발자가 혼동할 여지가 있음.
  - 제안: `CLAUDE.md` 또는 README에 "프론트엔드: Vitest, 백엔드: Jest" 명시적으로 기록

---

- **[INFO] `socket.ts` - 모듈 레벨 싱글톤과 SSR 호환성**
  - 위치: 파일 28, `let socket: Socket | null = null;`
  - 상세: 모듈 레벨 변수로 소켓 싱글톤을 관리함. `'use client'` 디렉티브로 클라이언트 전용임을 표시하고 있어 Next.js SSR 문제는 방지되나, 테스트 환경에서 모듈 상태가 테스트 간 공유될 수 있음 (`SocketProvider.spec.tsx`에서 `vi.mock('@/src/lib/socket')`으로 적절히 모킹하고 있어 현재는 문제 없음).
  - 제안: 현 구조 유지 가능, 다만 `disconnectSocket()` 후 재연결 시나리오 테스트 커버리지 추가 권장

---

- **[INFO] `deck.ts` - Node.js 내장 `crypto.randomInt` 활용**
  - 위치: 파일 50, `import { randomInt } from 'crypto';`
  - 상세: 덱 셔플에 암호학적으로 안전한 난수 생성기 사용. 외부 의존성 없이 Node.js 내장 모듈 활용으로 적절함.
  - 제안: 없음 (Good practice)

---

- **[INFO] `GameRulesPanel.tsx` - 런타임 상수를 타입 파일에서 import**
  - 위치: 파일 9, `import { VARIANT_LABELS, MODE_LABELS } from '@/src/lib/types';`
  - 상세: `types.ts`가 타입 정의와 런타임 상수(`VARIANT_LABELS`, `MODE_LABELS`)를 함께 export함. 현재 구조는 동작하지만, 번들러가 타입만 필요한 경우에도 상수 코드를 포함시킬 수 있음.
  - 제안: 규모가 커질 경우 `constants.ts`로 분리 고려. 현재 규모에서는 허용 가능.

---

- **[INFO] `setup.ts` - `@testing-library/jest-dom/vitest` 전용 진입점 사용**
  - 위치: 파일 34
  - 상세: Vitest 전용 진입점(`/vitest`)을 명시적으로 사용하여 올바른 matchers 등록. 올바른 패턴.
  - 제안: 없음 (Good practice)

---

### 요약

전반적으로 의존성 관리가 양호하며, `crypto`, `Intl.NumberFormat` 등 외부 의존성 대신 내장 API를 적극 활용하는 점이 긍정적입니다. 주요 우려사항은 백엔드의 `.js` 확장자 ESM 패턴과 `__dirname` 사용 간의 일관성 문제와, `GameHistoryEntry` 타입의 불일치로 인해 발생하는 타입 단언입니다. 프론트엔드(Vitest)와 백엔드(Jest) 간 테스트 프레임워크 혼용은 모노레포에서 일반적이나 문서화가 필요합니다. 새로운 외부 패키지 추가는 없으며, 기존 의존성(`zustand`, `socket.io-client`, NestJS)이 적절히 활용되고 있습니다.

### 위험도

**LOW**