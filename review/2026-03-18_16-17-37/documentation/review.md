## 문서화 코드 리뷰

### 발견사항

---

**[INFO] 공개 Provider 컴포넌트에 JSDoc 없음**
- 위치: `SocketProvider.tsx`, `IdentityProvider.tsx`, `ToastProvider.tsx`
- 상세: 공개 Context/Provider 컴포넌트와 훅(`useSocket`, `useIdentity`, `useToast`)에 사용법 설명이 없습니다. 특히 `setNickname`의 반환 타입(`Promise<{ success, error? }>`)이나 `addToast`의 자동 제거(4초) 동작은 문서가 없으면 파악하기 어렵습니다.
- 제안: 최소한 각 훅의 반환값과 주요 동작을 JSDoc으로 명시

---

**[INFO] `useGameStore.ts`의 인라인 주석이 불충분**
- 위치: `frontend/src/hooks/useGameStore.ts`
- 상세: `reset()`이 `currentRoom`은 초기화하지만 `roomList`는 보존하는 의도적 설계가 주석 없이 코드만으로는 불명확합니다.
- 제안: `// roomList는 reset 대상 제외 — 로비로 돌아가도 방 목록은 유지` 형태의 주석 추가

---

**[INFO] `next.config.ts` rewrite 규칙에 주석 없음**
- 위치: `frontend/next.config.ts`
- 상세: `/api/:path*` → `http://localhost:3000/:path*` 프록시 설정이 개발 전용인지, 환경별 분기가 필요한지 명시되지 않았습니다. 프로덕션 배포 시 잘못 적용될 위험이 있습니다.
- 제안:
  ```typescript
  // 개발 환경: Next.js → NestJS 백엔드 프록시
  // 프로덕션에서는 NEXT_PUBLIC_BACKEND_URL 환경변수로 직접 통신
  ```

---

**[WARNING] `BACKEND_URL` 환경변수 문서화 없음**
- 위치: `frontend/src/lib/constants.ts:27`, `frontend/.env` (미제공)
- 상세: `NEXT_PUBLIC_BACKEND_URL` 환경변수가 코드에서 사용되지만, `.env.example`이나 README에 해당 변수에 대한 설명이 없습니다. 새 개발자가 설정 없이 실행하면 기본값(`http://localhost:3000`)으로 동작하지만, 이것이 의도된 기본값인지 불명확합니다.
- 제안: `frontend/.env.example` 파일 생성:
  ```
  # 백엔드 서버 주소 (기본값: http://localhost:3000)
  NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
  ```

---

**[INFO] `PokerTable.tsx`의 `SEAT_POSITIONS` 배열에 불충분한 주석**
- 위치: `frontend/src/components/game/table/PokerTable.tsx:17-24`
- 상세: 좌석 위치 계산 로직이 최대 6명을 지원하지만 7번째 이상 플레이어에 대해 `SEAT_POSITIONS[0]`으로 fallback하는 처리가 있습니다. 이 동작이 의도적인 방어 코드인지 주석이 없습니다.
- 제안: `// 7명 이상일 경우는 스펙상 없으나 방어적 처리로 index 0 fallback` 주석 추가

---

**[INFO] `CommunityCards.tsx`의 플레이스홀더 주석이 충분하지 않음**
- 위치: `frontend/src/components/game/table/CommunityCards.tsx:19`
- 상세: `{/* Placeholder for remaining cards */}` 주석이 있지만, Texas Hold'em 전용 컴포넌트임에도 다른 변형에서도 사용될 가능성에 대한 언급이 없습니다. 5장 고정(length 5 기준)으로 빈 슬롯을 채우는 이유도 불명확합니다.
- 제안: `{/* Hold'em 커뮤니티 카드: 최대 5장, 미공개 슬롯 표시 */}`로 개선

---

**[INFO] `HelpModal.tsx`의 하드코딩된 데이터에 유지보수 가이드 없음**
- 위치: `frontend/src/components/game/HelpModal.tsx:13-52`
- 상세: `HAND_RANKINGS`와 `VARIANT_RULES`가 컴포넌트 내부에 하드코딩되어 있습니다. 게임 규칙 변경 시 이 파일을 수정해야 함을 알기 어렵습니다. 또한 `VARIANT_RULES`의 기본값으로 `texas-holdem`을 사용하는 이유가 불명확합니다.
- 제안: 상수 위에 `// 게임 규칙 변경 시 이 파일의 VARIANT_RULES 수정 필요` 주석 추가, 또는 `constants.ts`로 이동 검토

---

**[INFO] `spec/` 문서와 실제 구현 간 일부 불일치**
- 위치: `spec/09-frontend-ui.md:148` vs 실제 구현
- 상세: 스펙에 `CardFan.tsx`, `CardBack.tsx`, `ReadyButton.tsx`, `ForfeitButton.tsx`, `HistoryEntry.tsx`, `PlayerListItem.tsx` 컴포넌트가 명시되어 있지만 이번 구현에서 누락되었습니다. 스펙 문서가 현재 상태와 불일치합니다.
- 제안: 스펙 문서에 `// TODO: 미구현` 표시 또는 스펙 업데이트

---

### 요약

전반적으로 스펙 문서(`spec/` 9개 파일)가 체계적으로 잘 작성되어 있어 시스템 의도 파악이 용이합니다. 다만 실제 코드 레벨에서는 Provider 훅의 반환 계약, 환경변수 설정, 개발/프로덕션 분기 등 운영상 중요한 정보에 대한 인라인 문서가 부재합니다. 특히 `NEXT_PUBLIC_BACKEND_URL` 환경변수 문서화 누락과 `next.config.ts` 프록시 설정의 환경 범위 미명시는 새 개발자나 배포 시 혼란을 유발할 수 있습니다. 스펙과 구현 간의 컴포넌트 불일치도 점진적으로 스펙 문서의 신뢰성을 저하시킬 수 있으므로 동기화가 필요합니다.

### 위험도

**LOW**