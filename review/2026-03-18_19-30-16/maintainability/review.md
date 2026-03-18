### 발견사항

- **[INFO]** `room.service.ts`의 `leaveRoom` 메서드가 다중 책임을 가짐
  - 위치: `room.service.ts` - `leaveRoom` 메서드 (180~197라인)
  - 상세: 방 삭제 시 게임/참가자 레코드 정리 로직이 인라인으로 포함되어 메서드가 여러 책임을 가짐. 현재는 소규모지만, 향후 추가 정리 로직이 생기면 메서드가 비대해질 수 있음
  - 제안: `deleteRoomWithGames(roomId, room)` 같은 private 메서드로 분리

- **[INFO]** `onDelete: 'CASCADE'` 추가와 수동 삭제 로직 공존
  - 위치: `game-participant.entity.ts`, `game.entity.ts`, `room.service.ts`
  - 상세: entity에 `onDelete: 'CASCADE'`를 추가했음에도 `room.service.ts`에서 참가자/게임을 수동으로 삭제하는 로직이 남아 있음. CASCADE가 올바르게 적용된다면 수동 삭제는 불필요하며, 두 방식이 공존하면 의도가 불분명해짐
  - 제안: CASCADE를 신뢰한다면 수동 삭제 로직 제거, 또는 CASCADE를 제거하고 수동 삭제만 유지 — 하나의 전략으로 통일

- **[INFO]** `mockParticipantRepository`가 테스트에서 실제로 검증되지 않음
  - 위치: `room.service.spec.ts` - `mockParticipantRepository`
  - 상세: `mockParticipantRepository`를 DI에 등록했지만, 테스트 케이스에서 해당 mock의 호출 여부를 검증하지 않음. 서비스 내 `participantRepository` 사용이 올바른지 확인할 수 없음
  - 제안: `expect(mockParticipantRepository.createQueryBuilder).toHaveBeenCalled()` 검증 추가

- **[INFO]** `Card.tsx`의 `SUIT_COLORS` fallback이 변경된 컬러와 불일치
  - 위치: `Card.tsx` - 53라인 (`suitColor` 변수)
  - 상세: `SUIT_COLORS[card.suit] ?? 'text-white'` — clubs/spades가 `text-gray-900`으로 변경되었지만, fallback 값은 여전히 `'text-white'`여서 알 수 없는 suit가 들어올 경우 의도와 다른 색상이 적용됨
  - 제안: fallback을 `'text-gray-900'`으로 변경하거나, TypeScript 타입으로 알 수 없는 suit 자체를 차단

---

### 요약

이번 변경의 핵심인 CASCADE 설정과 수동 삭제 로직 추가는 기능적 문제를 해결하려는 의도가 명확하나, **두 삭제 전략이 동시에 존재**하는 점이 가장 큰 유지보수 위험입니다. 어떤 전략이 실제로 삭제를 담당하는지 코드만으로 파악하기 어려우며, 향후 개발자가 혼란을 겪을 수 있습니다. `Card.tsx`의 색상 수정은 간결하고 의도가 명확하며, 테스트 코드 구조도 전반적으로 기존 패턴을 잘 따르고 있습니다.

### 위험도

**LOW**