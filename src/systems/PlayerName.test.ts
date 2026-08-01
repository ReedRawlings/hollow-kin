import { describe, expect, it } from 'vitest';
import { PLAYER_NAME_MAX_LENGTH, sanitizePlayerName, validPlayerName } from './PlayerName';

describe('player names', () => {
  it('allows common punctuation and strips display-unsafe characters', () => {
    expect(sanitizePlayerName("  O'Rin_!  ")).toBe(" O'Rin ");
  });

  it('caps length and rejects blank names', () => {
    expect(sanitizePlayerName('abcdefghijklmnop')).toHaveLength(PLAYER_NAME_MAX_LENGTH);
    expect(validPlayerName('   ')).toBe(false);
    expect(validPlayerName('Mae')).toBe(true);
  });
});
