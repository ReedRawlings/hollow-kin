export const PLAYER_NAME_MAX_LENGTH = 12;

/** Names stay display-safe while allowing common names such as O'Rin and Ana-Mae. */
export function sanitizePlayerName(value: string): string {
  return value
    .replace(/[^A-Za-z0-9 '\-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, PLAYER_NAME_MAX_LENGTH);
}

export function validPlayerName(value: string): boolean {
  return sanitizePlayerName(value).trim().length > 0;
}
