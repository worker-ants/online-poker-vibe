export const AI_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Eve',
  'Frank',
] as const;

export const AI_UUID_PREFIX = 'ai-player-';

export function isAiPlayer(uuid: string): boolean {
  return uuid.startsWith(AI_UUID_PREFIX);
}
