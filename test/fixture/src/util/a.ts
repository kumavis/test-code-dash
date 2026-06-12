import { stripPunctuation } from './b.js';

export const SEPARATOR = ' ';

/** Normalizes a display line. */
export function normalize(line: string): string {
  return stripPunctuation(line.trim().toLowerCase());
}
