import ts from 'typescript';
import type { ReferenceSite } from '../model.js';
import { relPath, type LoadedProject } from './project.js';
import { enclosingSymbolId, type SymbolTable } from './symbols.js';
import { resolveNodeToSymbolId } from './resolve.js';

/** True when `id` is the declared name of the symbol declaration it sits in. */
function isDeclarationName(id: ts.Identifier, table: SymbolTable): boolean {
  const parent = id.parent;
  if (!table.idByNode.has(parent)) return false;
  // The name position of a declaration node: skip it so a symbol does not
  // "reference" itself at its own declaration.
  return (
    (ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isBindingElement(parent)) &&
    parent.name === id
  );
}

/**
 * Builds the reference index: every identifier that resolves to a
 * project-declared symbol becomes a use site (excluding the declaration's own
 * name). One pass, reusing the call-graph's alias-following resolver. Same
 * accepted limitation: dynamic/structural uses resolve to the declaration
 * site, not all implementations.
 */
export function buildReferences(project: LoadedProject, table: SymbolTable): ReferenceSite[] {
  const { checker } = project;
  const refs: ReferenceSite[] = [];
  const seen = new Set<string>();

  for (const sf of project.sourceFiles) {
    const file = relPath(project, sf);
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && !isDeclarationName(node, table)) {
        const to = resolveNodeToSymbolId(checker, table, node);
        if (to) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          const key = `${to}|${file}|${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            refs.push({ to, file, line, inSymbol: enclosingSymbolId(table, node) });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  refs.sort(
    (a, b) => a.to.localeCompare(b.to) || a.file.localeCompare(b.file) || a.line - b.line,
  );
  return refs;
}
