#!/usr/bin/env node
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { analyze } from './analyzer/index.js';
import { renderDashboard } from './dashboard/generate.js';

function usage(): never {
  console.error('Usage: cad <projectDir> [-o <outDir>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { projectDir: string; outDir: string } {
  let projectDir: string | undefined;
  let outDir = 'out';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-o' || arg === '--out') {
      outDir = argv[++i] ?? usage();
    } else if (arg === '-h' || arg === '--help') {
      usage();
    } else if (!projectDir) {
      projectDir = arg;
    } else {
      usage();
    }
  }
  if (!projectDir) usage();
  return { projectDir, outDir };
}

const { projectDir, outDir } = parseArgs(process.argv.slice(2));
const root = resolve(projectDir);
try {
  if (!statSync(root).isDirectory()) usage();
} catch {
  console.error(`Not a directory: ${root}`);
  process.exit(1);
}

const model = analyze(root);
mkdirSync(outDir, { recursive: true });
const modelPath = join(outDir, 'model.json');
writeFileSync(modelPath, JSON.stringify(model, null, 2));
const htmlPath = join(outDir, 'index.html');
writeFileSync(htmlPath, renderDashboard(model));
console.log(`Analyzed ${model.meta.fileCount} files -> ${modelPath}`);
console.log(`Dashboard -> ${htmlPath}`);
