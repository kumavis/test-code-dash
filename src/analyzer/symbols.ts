import ts from 'typescript';
import type { FileInfo, SymbolInfo, SymbolKind } from '../model.js';
import { relPath, type LoadedProject } from './project.js';

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/** Names re-exported via `export { a, b }` lists (no module specifier). */
function localExportNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (
      ts.isExportDeclaration(stmt) &&
      !stmt.moduleSpecifier &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      for (const el of stmt.exportClause.elements) {
        names.add((el.propertyName ?? el.name).text);
      }
    }
  }
  return names;
}

function isDocumented(node: ts.Node): boolean {
  return ts.getJSDocCommentsAndTags(node).length > 0;
}

interface CollectedSymbol extends SymbolInfo {
  /** The declaration node, for downstream layers (call graph, complexity). */
  node: ts.Node;
}

export interface SymbolTable {
  symbols: CollectedSymbol[];
  /** Declaration node -> symbol id, for cross-layer resolution. */
  idByNode: Map<ts.Node, string>;
}

/** Layer 2: functions, classes, methods, interfaces, type aliases, enums, variables. */
export function collectSymbols(project: LoadedProject): SymbolTable {
  const symbols: CollectedSymbol[] = [];
  const idByNode = new Map<ts.Node, string>();

  for (const sf of project.sourceFiles) {
    const file = relPath(project, sf);
    const exportedNames = localExportNames(sf);

    const add = (
      node: ts.Node,
      name: string,
      kind: SymbolKind,
      exported: boolean,
      docNode: ts.Node = node,
    ): void => {
      const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      const id = `${file}#${name}`;
      idByNode.set(node, id);
      symbols.push({
        id,
        name,
        kind,
        file,
        line: start,
        endLine: end,
        exported,
        documented: isDocumented(docNode),
        complexity: null,
        node,
      });
    };

    const addMembers = (decl: ts.ClassDeclaration, className: string): void => {
      for (const member of decl.members) {
        if (ts.isConstructorDeclaration(member)) {
          add(member, `${className}.constructor`, 'method', false);
        } else if (
          (ts.isMethodDeclaration(member) ||
            ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member)) &&
          (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
        ) {
          add(member, `${className}.${member.name.text}`, 'method', false);
        }
      }
    };

    for (const stmt of sf.statements) {
      const exported = hasExportModifier(stmt);
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        add(stmt, stmt.name.text, 'function', exported || exportedNames.has(stmt.name.text));
      } else if (ts.isClassDeclaration(stmt) && stmt.name) {
        const name = stmt.name.text;
        add(stmt, name, 'class', exported || exportedNames.has(name));
        addMembers(stmt, name);
      } else if (ts.isInterfaceDeclaration(stmt)) {
        add(stmt, stmt.name.text, 'interface', exported || exportedNames.has(stmt.name.text));
      } else if (ts.isTypeAliasDeclaration(stmt)) {
        add(stmt, stmt.name.text, 'typeAlias', exported || exportedNames.has(stmt.name.text));
      } else if (ts.isEnumDeclaration(stmt)) {
        add(stmt, stmt.name.text, 'enum', exported || exportedNames.has(stmt.name.text));
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            // JSDoc attaches to the statement, not the declaration.
            add(decl, decl.name.text, 'variable', exported || exportedNames.has(decl.name.text), stmt);
          }
        }
      }
    }
  }

  return { symbols, idByNode };
}

/** Layer 10: fraction of a file's exported top-level symbols that carry docs. */
export function applyDocCoverage(files: FileInfo[], table: SymbolTable): void {
  for (const file of files) {
    const exported = table.symbols.filter(
      (s) => s.file === file.path && s.exported && s.kind !== 'method',
    );
    file.docCoverage = exported.length
      ? exported.filter((s) => s.documented).length / exported.length
      : null;
  }
}

/** Strips analyzer-internal fields for the serialized model. */
export function toSymbolInfos(table: SymbolTable): SymbolInfo[] {
  return table.symbols.map(({ node: _node, ...info }) => info);
}
