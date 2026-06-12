import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface LoadedProject {
  program: ts.Program;
  checker: ts.TypeChecker;
  options: ts.CompilerOptions;
  root: string;
  /** Project-owned source files: no declaration files, nothing under node_modules. */
  sourceFiles: ts.SourceFile[];
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'coverage', '.git']);

function scanSourceFiles(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        scanSourceFiles(join(dir, entry.name), acc);
      }
    } else if (
      SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) &&
      !entry.name.endsWith('.d.ts')
    ) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

const FALLBACK_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  allowJs: true,
  checkJs: false,
  noEmit: true,
  skipLibCheck: true,
};

/**
 * Loads a ts.Program for the project at `root`: from its tsconfig.json when
 * one exists inside the root, otherwise by scanning for source files.
 */
export function loadProject(root: string): LoadedProject {
  const absRoot = resolve(root);
  const configPath = ts.findConfigFile(absRoot, ts.sys.fileExists, 'tsconfig.json');

  let fileNames: string[];
  let options: ts.CompilerOptions;
  // findConfigFile searches upward; only trust a config inside the root,
  // otherwise an unrelated ancestor tsconfig would hijack the analysis.
  if (configPath && resolve(configPath).startsWith(absRoot)) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config ?? {},
      ts.sys,
      resolve(configPath, '..'),
    );
    fileNames = parsed.fileNames;
    options = { ...parsed.options, noEmit: true };
  } else {
    fileNames = scanSourceFiles(absRoot, []);
    options = FALLBACK_OPTIONS;
  }

  const program = ts.createProgram(fileNames, options);
  const sourceFiles = program
    .getSourceFiles()
    .filter(
      (sf) =>
        !sf.isDeclarationFile &&
        !sf.fileName.includes('/node_modules/') &&
        resolve(sf.fileName).startsWith(absRoot),
    );

  return { program, checker: program.getTypeChecker(), options, root: absRoot, sourceFiles };
}

/** Path of `sf` relative to the project root, with forward slashes. */
export function relPath(project: LoadedProject, sf: ts.SourceFile): string {
  return relative(project.root, resolve(sf.fileName)).split('\\').join('/');
}
