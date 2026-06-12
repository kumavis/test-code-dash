import { resolve } from 'node:path';
import type { AnalysisModel } from '../model.js';

export const TOOL_NAME = 'code-analysis-dashboard';
export const TOOL_VERSION = '0.1.0';

/** Runs every analysis layer against the project at `projectRoot`. */
export function analyze(projectRoot: string): AnalysisModel {
  const root = resolve(projectRoot);
  return {
    meta: {
      tool: TOOL_NAME,
      version: TOOL_VERSION,
      analyzedAt: new Date().toISOString(),
      projectRoot: root,
      fileCount: 0,
    },
    files: [],
    moduleGraph: { nodes: [], edges: [], cycles: [] },
    symbols: [],
    typeGraph: [],
    callGraph: { edges: [], uncalled: [] },
    apiUsage: [],
  };
}
