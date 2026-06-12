import ts from 'typescript';
import type { SymbolTable } from './symbols.js';

/**
 * Resolves an identifier/expression to the id of a project-declared symbol,
 * following import aliases. Returns undefined for externals (lib, deps).
 */
export function resolveNodeToSymbolId(
  checker: ts.TypeChecker,
  table: SymbolTable,
  node: ts.Node,
): string | undefined {
  let symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  for (const decl of symbol.declarations ?? []) {
    const id = table.idByNode.get(decl);
    if (id) return id;
  }
  return undefined;
}
