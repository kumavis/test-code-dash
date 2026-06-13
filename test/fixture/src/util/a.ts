import { stripPunctuation } from './b.js';

export const SEPARATOR = ' ';

// Destructuring declarations: each bound name is its own symbol.
const config = { prefix: '>', limit: 3, nested: { tag: 'x' } };
export const { prefix, nested: { tag } } = config;
const pair: [number, string] = [1, 'a'];
const [, second] = pair; // leading hole is skipped

/** Normalizes a display line. */
export function normalize(line: string): string {
  return stripPunctuation(line.trim().toLowerCase());
}
