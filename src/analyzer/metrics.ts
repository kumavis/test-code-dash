import ts from 'typescript';
import { isFunctionLikeSymbolNode, type SymbolTable } from './symbols.js';

const DECISION_BINARY_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function isDecisionPoint(node: ts.Node): boolean {
  switch (node.kind) {
    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.ForStatement:
    case ts.SyntaxKind.ForInStatement:
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.DoStatement:
    case ts.SyntaxKind.CaseClause:
    case ts.SyntaxKind.CatchClause:
    case ts.SyntaxKind.ConditionalExpression:
      return true;
    case ts.SyntaxKind.BinaryExpression:
      return DECISION_BINARY_OPERATORS.has((node as ts.BinaryExpression).operatorToken.kind);
    default:
      return false;
  }
}

/** Cyclomatic complexity: 1 + decision points in the function body. */
export function cyclomaticComplexity(fn: ts.Node): number {
  let count = 1;
  const visit = (node: ts.Node): void => {
    if (isDecisionPoint(node)) count++;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn, visit);
  return count;
}

/** Layer 8 (complexity axis): fills `complexity` on function-like symbols. */
export function applyComplexity(table: SymbolTable): void {
  for (const sym of table.symbols) {
    if (isFunctionLikeSymbolNode(sym.node)) {
      sym.complexity = cyclomaticComplexity(sym.node);
    }
  }
}
