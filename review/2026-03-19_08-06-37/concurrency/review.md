### 발견사항

- **[WARNING]** `deleteByRoom`의 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건
  - 위치: `game.service.ts` — `deleteByRoom` 메서드
  - 상세: `find` 쿼리가 트랜잭션 외부에서 실행된다. `find`로 'in-progress' 게임 목록을 읽은 후 트랜잭션을 시작하기까지의 시간 간격 동안, `finishGame`이 동시에 실행되어 해당 게임의 status를 'completed'로 커밋할 수 있다. 이 경우 `deleteByRoom`은 이미 완료된 게임 레코드를 삭제하게 되어 명예의 전당 데이터가 유실된다.
  - 제안: `find` 쿼리를 트랜잭션 내부로 이동시켜 단일 원자적 단위로 처리해야 한다.
    ```typescript
    async deleteByRoom(roomId: string): Promise<void> {
      const queryRunner = this.gameRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const games = await queryRunner.manager.find(Game, {
          where: { roomId, status: 'in-progress' },
        });
        if (games.length > 0) {
          const gameIds = games.map((g) => g.id);
          await queryRunner.manager
            .createQueryBuilder()
            .delete()
            .from(GameParticipant)
            .where('gameId IN (:...gameIds)', { gameIds })
            .execute();
          await queryRunner.manager.remove(games);
        }
        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    }
    ```

- **[INFO]** `finishGame`에서 `activeGames.delete`가 트랜잭션 커밋 이후에 실행됨
  - 위치: `game.service.ts` — `finishGame` 메서드 말미
  - 상세: `commitTransaction()` 성공 후 `this.activeGames.delete(active.roomId)` 전에 프로세스가 비정상 종료될 경우, DB에는 'completed'로 기록되었지만 인메모리 `activeGames`에는 여전히 활성 게임이 남아 있는 불일치 상태가 발생할 수 있다. 재시작 시 `onModuleInit`의 abandoned 처리가 이를 부분적으로 복구하지만, 이미 완료된 게임을 abandoned로 잘못 표시할 우려는 없다(status가 'completed'이므로 `{ status: 'in-progress' }` 조건에 해당하지 않음). 단, 새 게임 시작 guard에서 DB와 인메모리 상태 불일치가 오동작을 유발할 수 있다.
  - 제안: 현재 구조에서는 큰 위험은 없으나, 향후 복잡도가 높아질 경우 `activeGames.delete`를 커밋 직전으로 이동하거나 try-finally로 보장하는 것을 고려할 수 있다.

- **[INFO]** `deleteByRoom`과 `activeGames` 인메모리 상태의 비동기화
  - 위치: `game.service.ts` — `deleteByRoom` 메서드
  - 상세: `deleteByRoom`은 DB에서 게임 레코드를 삭제하지만 `activeGames` Map을 정리하지 않는다. 방 삭제 흐름에서 호출처가 `activeGames`도 함께 정리한다면 문제없지만, 그렇지 않은 경우 고아(orphan) 인메모리 게임 상태가 남는다.
  - 제안: 호출처 코드 확인이 필요하며, 필요시 `deleteByRoom` 내에서 `this.activeGames.delete(roomId)` 호출을 포함시키는 것을 검토.

---

### 요약

변경 사항 중 동시성 관점에서 가장 주목할 부분은 `deleteByRoom`의 TOCTOU 경쟁 조건이다. `find`와 트랜잭션 시작이 분리되어 있어, `finishGame`과의 동시 실행 시 완료된 게임 레코드가 삭제될 수 있으며 명예의 전당 데이터 유실로 이어진다. 나머지 파일들(엔티티 nullable 변경, 테스트 코드 수정, 문서 수정)은 동시성 관점의 문제를 직접적으로 포함하지 않는다. Node.js의 단일 스레드 이벤트 루프 특성상 동기 코드 내의 공유 자원 접근은 안전하지만, DB 레벨 원자성은 별도로 보장해야 한다.

### 위험도
**MEDIUM**