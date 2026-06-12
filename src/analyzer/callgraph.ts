import ts from 'typescript';
import type { CallEdge, CallGraph } from '../model.js';
import { relPath, type LoadedProject } from './project.js';
import { isFunctionLikeSymbolNode, type SymbolTable } from './symbols.js';
import { resolveNodeToSymbolId } from './resolve.js';

/** Id used as the caller for calls made at a module's top level. */
export function moduleCallerId(file: string): string {
  return `${file}#<module>`;
}

/**
 * Layer 4: static call graph. Each call/new expression is attributed to its
 * nearest enclosing declared symbol (or the module pseudo-node) and resolved
 * to the callee's declaration. Known limitation, accepted in the design:
 * dynamic dispatch through an interface resolves to the interface member
 * (not collected), so such edges are dropped.
 */
export function buildCallGraph(project: LoadedProject, table: SymbolTable): CallGraph {
  const { checker } = project;
  const edges: CallEdge[] = [];
  const seen = new Set<string>();

  const enclosingCallerId = (node: ts.Node, file: string): string => {
    for (let cur = node.parent; cur; cur = cur.parent) {
      const id = table.idByNode.get(cur);
      if (id && isFunctionLikeSymbolNode(cur)) return id;
    }
    return moduleCallerId(file);
  };

  const calleeId = (expr: ts.CallExpression | ts.NewExpression): string | undefined => {
    const target = expr.expression;
    if (ts.isNewExpression(expr)) {
      const classId = resolveNodeToSymbolId(checker, table, target);
      if (!classId) return undefined;
      // Prefer the constructor symbol when the class declares one.
      const ctorId = `${classId.split('#')[0]}#${classId.split('#')[1]}.constructor`;
      return table.symbols.some((s) => s.id === ctorId) ? ctorId : classId;
    }
    if (ts.isIdentifier(target) || ts.isPropertyAccessExpression(target)) {
      const node = ts.isPropertyAccessExpression(target) ? target.name : target;
      return resolveNodeToSymbolId(checker, table, node);
    }
    return undefined;
  };

  for (const sf of project.sourceFiles) {
    const file = relPath(project, sf);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const to = calleeId(node);
        if (to) {
          const from = enclosingCallerId(node, file);
          const key = `${from}|${to}`;
          if (from !== to && !seen.has(key)) {
            seen.add(key);
            edges.push({ from, to });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  const called = new Set(edges.map((e) => e.to));
  const uncalled = table.symbols
    .filter((s) => isFunctionLikeSymbolNode(s.node) && !called.has(s.id))
    .map((s) => s.id)
    .sort();

  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return { edges, uncalled };
}
