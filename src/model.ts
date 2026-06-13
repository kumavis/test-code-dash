/**
 * The output-model contract: one AnalysisModel object is produced per run
 * and consumed by the dashboard. Symbol ids are `relativePath#qualifiedName`
 * strings, stable across layers so every view can cross-link.
 */

export interface AnalysisMeta {
  tool: string;
  version: string;
  analyzedAt: string;
  projectRoot: string;
  fileCount: number;
}

export interface FileInfo {
  /** Path relative to the analyzed project root, with forward slashes. */
  path: string;
  loc: number;
  bytes: number;
  /** Number of commits touching this file (null when not a git repo). */
  churn: number | null;
  /** Fraction of exported symbols with doc comments (null if none exported). */
  docCoverage: number | null;
}

export interface ModuleEdge {
  from: string;
  to: string;
}

export interface ModuleGraph {
  /** File paths participating in the graph. */
  nodes: string[];
  edges: ModuleEdge[];
  /** Strongly connected components with more than one member. */
  cycles: string[][];
}

export type SymbolKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'typeAlias'
  | 'enum'
  | 'variable';

export interface SymbolInfo {
  /** `relativePath#qualifiedName`, e.g. `src/app.ts#Dog.speak`. */
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  endLine: number;
  exported: boolean;
  documented: boolean;
  /** Cyclomatic complexity for function-like symbols, null otherwise. */
  complexity: number | null;
}

export type TypeRelation = 'extends' | 'implements' | 'alias';

export interface TypeEdge {
  from: string;
  to: string;
  relation: TypeRelation;
}

export interface CallEdge {
  /** Caller symbol id. */
  from: string;
  /** Callee symbol id. */
  to: string;
}

export interface CallGraph {
  edges: CallEdge[];
  /** Function-like symbols with no incoming call edges. */
  uncalled: string[];
}

export type ApiCategory =
  | 'filesystem'
  | 'network'
  | 'process'
  | 'shell'
  | 'crypto'
  | 'dom'
  | 'storage'
  | 'database';

export interface ApiUsage {
  category: ApiCategory;
  /** The concrete API touched, e.g. `fs.readFileSync` or `fetch`. */
  api: string;
  file: string;
  line: number;
  /** Enclosing symbol id, null at module top level. */
  inSymbol: string | null;
}

/** A single use site of a project-declared symbol (powers "where is X used"). */
export interface ReferenceSite {
  /** The referenced symbol id. */
  to: string;
  file: string;
  line: number;
  /** Enclosing function-like symbol id, null at module top level. */
  inSymbol: string | null;
}

export interface AnalysisModel {
  meta: AnalysisMeta;
  files: FileInfo[];
  moduleGraph: ModuleGraph;
  symbols: SymbolInfo[];
  typeGraph: TypeEdge[];
  callGraph: CallGraph;
  apiUsage: ApiUsage[];
  references: ReferenceSite[];
}
