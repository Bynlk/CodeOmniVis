#!/usr/bin/env node
/* AST type-safety scan: counts any / unknown / assertions / doubleCasts across the repo. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const ex = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.turbo', '.next']);
const exts = new Set(['.ts', '.tsx', '.mts', '.cts']);
let any = 0, unknown = 0, assertions = 0, doubleCasts = 0, recordUnknown = 0;

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (ex.has(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, o);
    else if (e.isFile() && exts.has(path.extname(e.name))) o.push(f);
  }
  return o;
}

for (const f of walk(root)) {
  const sf = ts.createSourceFile(
    f,
    fs.readFileSync(f, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  function visit(n) {
    if (
      ts.isTypeReferenceNode(n) &&
      ts.isIdentifier(n.typeName) &&
      n.typeName.escapedText === 'Record' &&
      n.typeArguments && n.typeArguments.length === 2 &&
      n.typeArguments[1].kind === ts.SyntaxKind.UnknownKeyword
    ) recordUnknown++;
    if (n.kind === ts.SyntaxKind.AnyKeyword) any++;
    else if (n.kind === ts.SyntaxKind.UnknownKeyword) unknown++;
    else if (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || ts.isNonNullExpression(n)) assertions++;
    if ((ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) &&
        (ts.isAsExpression(n.expression) || ts.isTypeAssertionExpression(n.expression))) doubleCasts++;
    ts.forEachChild(n, visit);
  }
  visit(sf);
}
console.log(JSON.stringify({ any, unknown, assertions, doubleCasts, recordUnknown }));
