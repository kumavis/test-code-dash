import { SEPARATOR } from './a.js';

// Imports from a.ts, which imports this file: deliberate cycle.
export function stripPunctuation(line: string): string {
  return line
    .split(SEPARATOR)
    .map((w) => w.replace(/[!.,]/g, ''))
    .join(SEPARATOR);
}
