import { readFileSync } from 'node:fs';

/** Reads fixture config from disk and the environment. */
export function loadConfig(): { mood: string; host: string } {
  let mood = 'happy';
  try {
    mood = readFileSync('/tmp/mood.txt', 'utf8').trim();
  } catch {
    mood = process.env.FIXTURE_MOOD ?? 'happy';
  }
  return { mood, host: process.env.FIXTURE_HOST ?? 'localhost' };
}
