import ts from 'typescript';
import type { TypeEdge } from '../model.js';
import type { LoadedProject } from './project.js';
import type { SymbolTable } from './symbols.js';
import { resolveNodeToSymbolId } from './resolve.js';

/** Layer 3: extends / implements / alias edges between project type declarations. */
export function buildTypeGraph(project: LoadedProject, table: SymbolTable): TypeEdge[] {
  const { checker } = project;
  const edges: TypeEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (from: string, toNode: ts.Node, relation: TypeEdge['relation']): void => {
    const to = resolveNodeToSymbolId(checker, table, toNode);
    if (!to || to === from) return;
    const key = `${from}|${to}|${relation}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, relation });
  };

  for (const sym of table.symbols) {
    const node = sym.node;
    if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      for (const clause of node.heritageClauses ?? []) {
        const relation =
          clause.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends';
        for (const typeExpr of clause.types) {
          addEdge(sym.id, typeExpr.expression, relation);
        }
      }
    } else if (ts.isTypeAliasDeclaration(node)) {
      // Every named type the alias body references, e.g. `type R = Animal | Dog`.
      const visit = (child: ts.Node): void => {
        if (ts.isTypeReferenceNode(child)) addEdge(sym.id, child.typeName, 'alias');
        ts.forEachChild(child, visit);
      };
      visit(node.type);
    }
  }

  return edges;
}
