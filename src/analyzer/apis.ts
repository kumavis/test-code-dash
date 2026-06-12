import ts from 'typescript';
import type { ApiCategory, ApiUsage } from '../model.js';
import { relPath, type LoadedProject } from './project.js';
import { isFunctionLikeSymbolNode, type SymbolTable } from './symbols.js';

/** Node built-in modules that imply a privilege category. */
const MODULE_CATEGORIES: Record<string, ApiCategory> = {
  fs: 'filesystem',
  'fs/promises': 'filesystem',
  child_process: 'shell',
  http: 'network',
  https: 'network',
  http2: 'network',
  net: 'network',
  tls: 'network',
  dgram: 'network',
  dns: 'network',
  crypto: 'crypto',
};

/** Well-known database client packages (matched on the package root). */
const DATABASE_PACKAGES = new Set([
  'pg',
  'mysql',
  'mysql2',
  'mongodb',
  'mongoose',
  'redis',
  'ioredis',
  'sqlite3',
  'better-sqlite3',
  'knex',
  'prisma',
  '@prisma/client',
  'typeorm',
  'sequelize',
]);

/** Ambient globals that imply a privilege category. */
const GLOBAL_CATEGORIES: Record<string, ApiCategory> = {
  fetch: 'network',
  XMLHttpRequest: 'network',
  WebSocket: 'network',
  EventSource: 'network',
  process: 'process',
  document: 'dom',
  window: 'dom',
  localStorage: 'storage',
  sessionStorage: 'storage',
  indexedDB: 'storage',
};

function categorizeSpecifier(spec: string): { category: ApiCategory; module: string } | null {
  const bare = spec.startsWith('node:') ? spec.slice(5) : spec;
  if (MODULE_CATEGORIES[bare]) return { category: MODULE_CATEGORIES[bare], module: bare };
  const packageRoot = bare.startsWith('@')
    ? bare.split('/').slice(0, 2).join('/')
    : bare.split('/')[0];
  if (DATABASE_PACKAGES.has(packageRoot)) return { category: 'database', module: packageRoot };
  return null;
}

interface ImportedName {
  category: ApiCategory;
  /** Rendered API, e.g. `fs.readFileSync`; namespaces resolve per property access. */
  api: string;
  namespace: boolean;
}

/** Layer 7: where the project touches privileged platform APIs. */
export function findApiUsage(project: LoadedProject, table: SymbolTable): ApiUsage[] {
  const { checker } = project;
  const usages: ApiUsage[] = [];
  const seen = new Set<string>();

  for (const sf of project.sourceFiles) {
    const file = relPath(project, sf);

    const enclosingSymbolId = (node: ts.Node): string | null => {
      for (let cur = node.parent; cur; cur = cur.parent) {
        const id = table.idByNode.get(cur);
        if (id && isFunctionLikeSymbolNode(cur)) return id;
      }
      return null;
    };

    const record = (node: ts.Node, category: ApiCategory, api: string): void => {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const key = `${file}|${line}|${api}`;
      if (seen.has(key)) return;
      seen.add(key);
      usages.push({ category, api, file, line, inSymbol: enclosingSymbolId(node) });
    };

    // Names bound by imports of categorized modules.
    const imported = new Map<string, ImportedName>();
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
      const hit = categorizeSpecifier(stmt.moduleSpecifier.text);
      if (!hit || !stmt.importClause) continue;
      const { category, module } = hit;
      const { name, namedBindings } = stmt.importClause;
      if (name) imported.set(name.text, { category, api: module, namespace: false });
      if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) {
          imported.set(namedBindings.name.text, { category, api: module, namespace: true });
        } else {
          for (const el of namedBindings.elements) {
            imported.set(el.name.text, {
              category,
              api: `${module}.${(el.propertyName ?? el.name).text}`,
              namespace: false,
            });
          }
        }
      }
    }

    const isGlobalReference = (id: ts.Identifier): boolean => {
      const symbol = checker.getSymbolAtLocation(id);
      if (!symbol) return true; // unresolved: assume ambient
      return (symbol.declarations ?? []).every((d) => d.getSourceFile().isDeclarationFile);
    };

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) return; // binding sites are not usages
      if (ts.isIdentifier(node)) {
        // Skip property names: only the `fs` in fs.readFileSync, not `readFileSync`.
        const isPropertyName =
          ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
        if (!isPropertyName) {
          const binding = imported.get(node.text);
          if (binding) {
            const api =
              binding.namespace && ts.isPropertyAccessExpression(node.parent)
                ? `${binding.api}.${node.parent.name.text}`
                : binding.api;
            record(node, binding.category, api);
            return;
          }
          const globalCategory = GLOBAL_CATEGORIES[node.text];
          if (globalCategory && isGlobalReference(node)) {
            const api =
              ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node
                ? `${node.text}.${node.parent.name.text}`
                : node.text;
            record(node, globalCategory, api);
            return;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.api.localeCompare(b.api));
  return usages;
}
