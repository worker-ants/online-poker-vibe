import type {
  GameState,
  HandResult,
  PlayerState,
} from '../../common/types/game.types.js';
import type { Card } from '../../common/types/card.types.js';
import { HandEvaluator } from './hand-evaluator.js';
import { PotCalculator } from './pot-calculator.js';

/**
 * Shared hand resolution logic for all poker variants.
 *
 * @param state - The current game state.
 * @param handEvaluator - The hand evaluator instance.
 * @param potCalculator - The pot calculator instance.
 * @param getEvalCards - A function that returns the cards to evaluate for a given player and state.
 */
export function resolveHand(
  state: GameState,
  handEvaluator: HandEvaluator,
  potCalculator: PotCalculator,
  getEvalCards: (player: PlayerState, state: GameState) => Card[],
): HandResult {
  const activePlayers = state.players.filter((p) => !p.isFolded);

  // If only one player remains, they win everything
  if (activePlayers.length === 1) {
    return {
      winners: [
        {
          uuid: activePlayers[0].uuid,
          amount: state.pot,
          potType: 'main',
        },
      ],
      playerHands: [],
    };
  }

  // Evaluate hands
  const playerHands = activePlayers.map((p) => {
    const evalCards = getEvalCards(p, state);
    const handRank = handEvaluator.evaluate(evalCards);
    return { uuid: p.uuid, cards: evalCards, handRank };
  });

  // Calculate pots
  const pots = potCalculator.calculatePots(state.players);
  const winners: HandResult['winners'] = [];

  for (const pot of pots) {
    const eligible = playerHands.filter((ph) =>
      pot.playerUuids.includes(ph.uuid),
    );
    if (eligible.length === 0) continue;

    eligible.sort((a, b) => handEvaluator.compareHands(b.handRank, a.handRank));

    const bestHand = eligible[0].handRank;
    const tied = eligible.filter(
      (ph) => handEvaluator.compareHands(ph.handRank, bestHand) === 0,
    );

    const share = Math.floor(pot.amount / tied.length);
    const remainder = pot.amount % tied.length;

    tied.forEach((ph, i) => {
      winners.push({
        uuid: ph.uuid,
        amount: share + (i === 0 ? remainder : 0),
        potType: pots.indexOf(pot) === 0 ? 'main' : 'side',
      });
    });
  }

  // If no pots were calculated, give everything to best hand
  if (winners.length === 0 && playerHands.length > 0) {
    playerHands.sort((a, b) =>
      handEvaluator.compareHands(b.handRank, a.handRank),
    );
    winners.push({
      uuid: playerHands[0].uuid,
      amount: state.pot,
      potType: 'main',
    });
  }

  return { winners, playerHands };
}
