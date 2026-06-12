import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import type { FileInfo } from '../model.js';

/**
 * Layer 8 (churn axis): commits-touching-file counts from git history.
 * Leaves churn null when the project is not inside a git work tree.
 */
export function applyChurn(files: FileInfo[], projectRoot: string): void {
  let repoRoot: string;
  let log: string;
  try {
    repoRoot = execFileSync('git', ['-C', projectRoot, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    log = execFileSync(
      'git',
      ['-C', projectRoot, 'log', '--name-only', '--pretty=format:', '--', projectRoot],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 },
    );
  } catch {
    return;
  }

  // git paths are relative to the repo root; project paths to the project root.
  const prefix = relative(repoRoot, resolve(projectRoot)).split('\\').join('/');
  const counts = new Map<string, number>();
  for (const line of log.split('\n')) {
    if (!line) continue;
    const path =
      prefix && line.startsWith(prefix + '/') ? line.slice(prefix.length + 1) : prefix ? null : line;
    if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
  }

  for (const file of files) {
    file.churn = counts.get(file.path) ?? 0;
  }
}
