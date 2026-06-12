// Copies dashboard assets (plain JS/CSS, excluded from tsc) into dist.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'src', 'dashboard', 'assets');
const dest = join(root, 'dist', 'dashboard', 'assets');
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
