import { resolve } from 'node:path';
import type { AnalysisModel, FileInfo } from '../model.js';
import { loadProject, relPath } from './project.js';
import { buildModuleGraph } from './modules.js';
import { applyDocCoverage, collectSymbols, toSymbolInfos } from './symbols.js';
import { buildTypeGraph } from './types.js';
import { buildCallGraph } from './callgraph.js';

export const TOOL_NAME = 'code-analysis-dashboard';
export const TOOL_VERSION = '0.1.0';

/** Runs every analysis layer against the project at `projectRoot`. */
export function analyze(projectRoot: string): AnalysisModel {
  const root = resolve(projectRoot);
  const project = loadProject(root);

  const files: FileInfo[] = project.sourceFiles
    .map((sf) => ({
      path: relPath(project, sf),
      loc: sf.getLineStarts().length,
      bytes: Buffer.byteLength(sf.text, 'utf8'),
      churn: null,
      docCoverage: null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const symbolTable = collectSymbols(project);
  applyDocCoverage(files, symbolTable);

  return {
    meta: {
      tool: TOOL_NAME,
      version: TOOL_VERSION,
      analyzedAt: new Date().toISOString(),
      projectRoot: root,
      fileCount: files.length,
    },
    files,
    moduleGraph: buildModuleGraph(project),
    symbols: toSymbolInfos(symbolTable),
    typeGraph: buildTypeGraph(project, symbolTable),
    callGraph: buildCallGraph(project, symbolTable),
    apiUsage: [],
  };
}
