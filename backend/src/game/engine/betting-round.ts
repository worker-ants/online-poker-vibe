import type {
  GameState,
  PlayerAction,
  BettingAction,
} from '../../common/types/game.types.js';

export class BettingRound {
  /**
   * Get valid actions for the current player.
   */
  getValidActions(state: GameState): {
    actions: BettingAction[];
    callAmount: number;
    minRaise: number;
    maxRaise: number;
  } {
    const player = state.players[state.currentPlayerIndex];
    if (!player || player.isFolded || player.isAllIn) {
      return { actions: [], callAmount: 0, minRaise: 0, maxRaise: 0 };
    }

    const actions: BettingAction[] = ['fold'];
    const callAmount = state.currentBet - player.currentBet;
    const minRaise = state.currentBet + state.minRaise;
    const maxRaise = player.chips + player.currentBet; // All-in amount

    if (callAmount === 0) {
      actions.push('check');
    } else {
      if (player.chips >= callAmount) {
        actions.push('call');
      }
    }

    // Can raise if player has enough chips
    if (player.chips > callAmount) {
      actions.push('raise');
    }

    // All-in is always available
    actions.push('all-in');

    return { actions, callAmount, minRaise, maxRaise };
  }

  /**
   * Apply a betting action to the game state.
   * Returns a new state (immutable style).
   */
  applyAction(
    state: GameState,
    playerUuid: string,
    action: PlayerAction,
  ): GameState {
    const newState = this.cloneState(state);
    const playerIndex = newState.players.findIndex(
      (p) => p.uuid === playerUuid,
    );

    if (playerIndex === -1) {
      throw new Error('플레이어를 찾을 수 없습니다.');
    }

    if (playerIndex !== newState.currentPlayerIndex) {
      throw new Error('현재 턴이 아닙니다.');
    }

    const player = newState.players[playerIndex];

    if (player.isFolded || player.isAllIn) {
      throw new Error('이미 폴드했거나 올인 상태입니다.');
    }

    switch (action.type) {
      case 'fold':
        player.isFolded = true;
        break;

      case 'check': {
        const callNeeded = newState.currentBet - player.currentBet;
        if (callNeeded > 0) {
          throw new Error('체크할 수 없습니다. 콜 또는 폴드해야 합니다.');
        }
        break;
      }

      case 'call': {
        const callAmount = Math.min(
          newState.currentBet - player.currentBet,
          player.chips,
        );
        player.chips -= callAmount;
        player.currentBet += callAmount;
        newState.pot += callAmount;
        if (player.chips === 0) {
          player.isAllIn = true;
        }
        break;
      }

      case 'raise': {
        const raiseAmount = action.amount;
        if (raiseAmount === undefined) {
          throw new Error('레이즈 금액을 지정해야 합니다.');
        }
        if (!Number.isFinite(raiseAmount) || raiseAmount <= 0) {
          throw new Error('유효하지 않은 레이즈 금액입니다.');
        }

        const totalBet = raiseAmount;
        const additionalBet = totalBet - player.currentBet;

        if (additionalBet > player.chips) {
          throw new Error('칩이 부족합니다.');
        }

        if (
          totalBet < newState.currentBet + newState.minRaise &&
          additionalBet < player.chips
        ) {
          throw new Error('최소 레이즈 금액을 충족하지 못합니다.');
        }

        player.chips -= additionalBet;
        newState.pot += additionalBet;
        newState.minRaise = totalBet - newState.currentBet;
        newState.currentBet = totalBet;
        player.currentBet = totalBet;

        // Reset hasActed for other players (they need to respond to the raise)
        newState.players.forEach((p, i) => {
          if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
            p.hasActed = false;
          }
        });

        if (player.chips === 0) {
          player.isAllIn = true;
        }
        break;
      }

      case 'all-in': {
        const allInAmount = player.chips;
        const newBet = player.currentBet + allInAmount;
        player.chips = 0;
        player.isAllIn = true;
        newState.pot += allInAmount;

        if (newBet > newState.currentBet) {
          const raiseBy = newBet - newState.currentBet;
          if (raiseBy >= newState.minRaise) {
            newState.minRaise = raiseBy;
          }
          newState.currentBet = newBet;
          // Reset hasActed for other players
          newState.players.forEach((p, i) => {
            if (i !== playerIndex && !p.isFolded && !p.isAllIn) {
              p.hasActed = false;
            }
          });
        }

        player.currentBet = newBet;
        break;
      }

      default:
        throw new Error(`알 수 없는 액션: ${action.type}`);
    }

    player.hasActed = true;

    // Record action
    newState.roundHistory.push({
      playerUuid,
      action,
      timestamp: Date.now(),
    });

    // Move to next active player
    newState.currentPlayerIndex = this.findNextActivePlayer(
      newState,
      playerIndex,
    );

    return newState;
  }

  /**
   * Check if the betting round is complete.
   */
  isRoundComplete(state: GameState): boolean {
    const activePlayers = state.players.filter(
      (p) => !p.isFolded && !p.isAllIn,
    );

    // If only one non-folded player remains (including all-in), round is complete
    const nonFolded = state.players.filter((p) => !p.isFolded);
    if (nonFolded.length <= 1) return true;

    // If all active (non-folded, non-all-in) players have acted and bets are equal
    if (activePlayers.length === 0) return true;

    return activePlayers.every(
      (p) => p.hasActed && p.currentBet === state.currentBet,
    );
  }

  /**
   * Check if only one player remains (everyone else folded).
   */
  isOnlyOnePlayerRemaining(state: GameState): boolean {
    return state.players.filter((p) => !p.isFolded).length <= 1;
  }

  /**
   * Reset betting state for a new round.
   */
  resetForNewRound(state: GameState): GameState {
    const newState = this.cloneState(state);
    newState.currentBet = 0;
    newState.players.forEach((p) => {
      p.currentBet = 0;
      p.hasActed = false;
    });
    return newState;
  }

  /**
   * Find the next player who can act.
   */
  findNextActivePlayer(state: GameState, fromIndex: number): number {
    const numPlayers = state.players.length;
    for (let i = 1; i <= numPlayers; i++) {
      const idx = (fromIndex + i) % numPlayers;
      const player = state.players[idx];
      if (!player.isFolded && !player.isAllIn) {
        return idx;
      }
    }
    return -1; // No active players
  }

  private cloneState(state: GameState): GameState {
    return structuredClone(state);
  }
}
