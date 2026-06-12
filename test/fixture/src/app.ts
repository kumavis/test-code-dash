import { Animal, Dog, Puppy } from './models.js';
import { loadConfig } from './services/storage.js';
import { ping } from './services/network.js';
import { normalize } from './util/a.js';

/** Branchy on purpose: complexity-overlay target. */
export function classify(animal: Animal, mood: string): string {
  let label = '';
  if (animal.kind === 'dog') {
    if (mood === 'happy') label = 'good dog';
    else if (mood === 'sleepy') label = 'tired dog';
    else label = 'dog';
  } else if (animal.kind === 'cat') {
    label = mood === 'happy' ? 'rare event' : 'cat';
  } else {
    label = 'unknown';
  }
  for (let i = 0; i < label.length; i++) {
    if (label[i] === ' ') label = label.replace(' ', '-');
  }
  switch (mood) {
    case 'happy':
      return label + ' :)';
    case 'sad':
      return label + ' :(';
    default:
      return label;
  }
}

/** Entry behavior: builds the shelter report. */
export async function run(): Promise<string[]> {
  const config = loadConfig();
  const animals: Animal[] = [new Dog('Rex'), new Puppy('Bit')];
  const lines = animals.map((a) => classify(a, config.mood) + ' ' + a.speak());
  await ping(config.host);
  return lines.map((l) => normalize(l));
}
