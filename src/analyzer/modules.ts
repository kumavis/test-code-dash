import ts from 'typescript';
import { resolve } from 'node:path';
import type { ModuleGraph } from '../model.js';
import { relPath, type LoadedProject } from './project.js';

/** Module specifiers imported by a source file (static imports/re-exports + require/dynamic import). */
function importSpecifiers(sf: ts.SourceFile): string[] {
  const specs: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const callee = node.expression;
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const arg = node.arguments[0];
      if ((isRequire || isDynamicImport) && ts.isStringLiteral(arg)) {
        specs.push(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return specs;
}

/** Tarjan strongly-connected components; returns components with >1 member. */
function findCycles(nodes: string[], edges: Map<string, Set<string>>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const cycles: string[][] = [];

  const strongConnect = (v: string): void => {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of edges.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }
    if (lowlinks.get(v) === indices.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      if (component.length > 1) cycles.push(component.sort());
    }
  };

  for (const v of nodes) if (!indices.has(v)) strongConnect(v);
  return cycles;
}

/** Layer 1: which project modules import which, plus dependency cycles. */
export function buildModuleGraph(project: LoadedProject): ModuleGraph {
  const fileByAbsPath = new Map<string, string>();
  for (const sf of project.sourceFiles) {
    fileByAbsPath.set(resolve(sf.fileName), relPath(project, sf));
  }

  const nodes = [...fileByAbsPath.values()].sort();
  const adjacency = new Map<string, Set<string>>();
  for (const sf of project.sourceFiles) {
    const from = relPath(project, sf);
    for (const spec of importSpecifiers(sf)) {
      const resolved = ts.resolveModuleName(spec, sf.fileName, project.options, ts.sys)
        .resolvedModule;
      if (!resolved) continue;
      const to = fileByAbsPath.get(resolve(resolved.resolvedFileName));
      if (to === undefined || to === from) continue;
      if (!adjacency.has(from)) adjacency.set(from, new Set());
      adjacency.get(from)!.add(to);
    }
  }

  const edges = [...adjacency.entries()]
    .flatMap(([from, tos]) => [...tos].map((to) => ({ from, to })))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  return { nodes, edges, cycles: findCycles(nodes, adjacency) };
}
