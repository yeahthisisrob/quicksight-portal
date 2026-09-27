/**
 * A light parser for QuickSight calculated-field expressions.
 *
 * QuickSight's console validates expressions through a service; there is no
 * public API for it, so this is the portal's own: small, dependency-free,
 * shared by the backend (assistant, planner, playbooks, graph) and the
 * frontend. It knows the grammar well enough to tell a function's own
 * arguments apart (so `sum({x}, [{region}])` is a LAC-A aggregate while
 * `in({x}, ['a'])` is not), to read calc levels (`PRE_FILTER`, `PRE_AGG`),
 * and to list the fields and parameters an expression reads. It does not
 * type-check; QuickSight still has the last word on validity.
 *
 * Grammar, loosest binding first:
 *   or      := and (OR and)*
 *   and     := not (AND not)*
 *   not     := NOT not | compare
 *   compare := sum (( = | <> | != | < | > | <= | >= ) sum)?
 *   sum     := product (( + | - ) product)*
 *   product := unary (( * | / | % ) unary)*
 *   unary   := - unary | power
 *   power   := primary (^ unary)?
 *   primary := number | string | {field} | ${parameter} | name(args)
 *            | [item, ...] | name | ( or )
 *   item    := or (ASC | DESC)?
 */

export type ExpressionNode =
  | { type: 'number'; value: number; start: number; end: number }
  | { type: 'string'; value: string; start: number; end: number }
  | { type: 'field'; name: string; start: number; end: number }
  | { type: 'parameter'; name: string; start: number; end: number }
  | { type: 'keyword'; name: string; start: number; end: number }
  | { type: 'call'; name: string; args: ExpressionNode[]; start: number; end: number }
  | {
      type: 'list';
      items: Array<{ expression: ExpressionNode; order?: 'ASC' | 'DESC' }>;
      start: number;
      end: number;
    }
  | { type: 'unary'; op: string; arg: ExpressionNode; start: number; end: number }
  | {
      type: 'binary';
      op: string;
      left: ExpressionNode;
      right: ExpressionNode;
      start: number;
      end: number;
    };

export interface ParseError {
  message: string;
  /** Character offset the problem was found at. */
  position: number;
}

export type ParseResult = { ok: true; ast: ExpressionNode } | { ok: false; error: ParseError };

type TokenKind =
  | 'number'
  | 'string'
  | 'field'
  | 'parameter'
  | 'name'
  | 'op'
  | '('
  | ')'
  | '['
  | ']'
  | ','
  | 'end';

interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

class ExpressionSyntaxError extends Error {
  public constructor(
    message: string,
    public readonly position: number
  ) {
    super(message);
  }
}

const OPERATORS = ['<>', '!=', '<=', '>=', '=', '<', '>', '+', '-', '*', '/', '%', '^'];
const COMPARISONS = new Set(['=', '<>', '!=', '<', '>', '<=', '>=']);
const PUNCTUATION = new Set(['(', ')', '[', ']', ',']);

function readQuoted(source: string, start: number, close: string): number {
  let i = start + 1;
  while (i < source.length && source[i] !== close) {
    if (source[i] === '\\') i += 1;
    i += 1;
  }
  if (i >= source.length) {
    throw new ExpressionSyntaxError(`Unclosed ${close === '}' ? '{' : close}`, start);
  }
  return i + 1;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    const start = i;
    const push = (kind: TokenKind, end: number, text = source.slice(start, end)) => {
      tokens.push({ kind, text, start, end });
      i = end;
    };
    if (ch === '$' && source[i + 1] === '{') {
      const end = readQuoted(source, i + 1, '}');
      push('parameter', end, source.slice(i + 2, end - 1).trim());
    } else if (ch === '{') {
      const end = readQuoted(source, i, '}');
      push('field', end, source.slice(i + 1, end - 1).trim());
    } else if (ch === "'" || ch === '"') {
      const end = readQuoted(source, i, ch);
      push('string', end, source.slice(i + 1, end - 1));
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const match = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(source.slice(i))!;
      push('number', i + match[0].length);
    } else if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      push('name', i + match[0].length);
    } else if (PUNCTUATION.has(ch)) {
      push(ch as TokenKind, i + 1);
    } else {
      const op = OPERATORS.find((o) => source.startsWith(o, i));
      if (!op) throw new ExpressionSyntaxError(`Unexpected character ${ch}`, i);
      push('op', i + op.length);
    }
  }
  tokens.push({ kind: 'end', text: '', start: source.length, end: source.length });
  return tokens;
}

class Parser {
  private at = 0;

  public constructor(private readonly tokens: Token[]) {}

  public parse(): ExpressionNode {
    if (this.peek().kind === 'end') throw new ExpressionSyntaxError('The expression is empty', 0);
    const node = this.or();
    const next = this.peek();
    if (next.kind !== 'end') {
      throw new ExpressionSyntaxError(`Unexpected ${next.text || next.kind}`, next.start);
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.at]!;
  }

  private take(): Token {
    const token = this.tokens[this.at]!;
    if (token.kind !== 'end') this.at += 1;
    return token;
  }

  private expect(kind: TokenKind, what: string): Token {
    const token = this.peek();
    if (token.kind !== kind) {
      throw new ExpressionSyntaxError(
        `Expected ${what}${token.kind === 'end' ? ' before the end' : `, found ${token.text}`}`,
        token.start
      );
    }
    return this.take();
  }

  private isWord(word: string): boolean {
    const token = this.peek();
    return token.kind === 'name' && token.text.toUpperCase() === word;
  }

  private binary(op: string, left: ExpressionNode, right: ExpressionNode): ExpressionNode {
    return { type: 'binary', op, left, right, start: left.start, end: right.end };
  }

  private or(): ExpressionNode {
    let left = this.and();
    while (this.isWord('OR')) {
      this.take();
      left = this.binary('OR', left, this.and());
    }
    return left;
  }

  private and(): ExpressionNode {
    let left = this.not();
    while (this.isWord('AND')) {
      this.take();
      left = this.binary('AND', left, this.not());
    }
    return left;
  }

  private not(): ExpressionNode {
    if (this.isWord('NOT')) {
      const token = this.take();
      const arg = this.not();
      return { type: 'unary', op: 'NOT', arg, start: token.start, end: arg.end };
    }
    return this.compare();
  }

  private compare(): ExpressionNode {
    const left = this.sum();
    const token = this.peek();
    if (token.kind === 'op' && COMPARISONS.has(token.text)) {
      this.take();
      return this.binary(token.text, left, this.sum());
    }
    return left;
  }

  private sum(): ExpressionNode {
    let left = this.product();
    for (let token = this.peek(); token.kind === 'op' && '+-'.includes(token.text); ) {
      this.take();
      left = this.binary(token.text, left, this.product());
      token = this.peek();
    }
    return left;
  }

  private product(): ExpressionNode {
    let left = this.unary();
    for (let token = this.peek(); token.kind === 'op' && '*/%'.includes(token.text); ) {
      this.take();
      left = this.binary(token.text, left, this.unary());
      token = this.peek();
    }
    return left;
  }

  private unary(): ExpressionNode {
    const token = this.peek();
    if (token.kind === 'op' && token.text === '-') {
      this.take();
      const arg = this.unary();
      return { type: 'unary', op: '-', arg, start: token.start, end: arg.end };
    }
    return this.power();
  }

  private power(): ExpressionNode {
    const base = this.primary();
    const token = this.peek();
    if (token.kind === 'op' && token.text === '^') {
      this.take();
      return this.binary('^', base, this.unary());
    }
    return base;
  }

  private primary(): ExpressionNode {
    const token = this.peek();
    switch (token.kind) {
      case 'number':
        this.take();
        return { type: 'number', value: Number(token.text), start: token.start, end: token.end };
      case 'string':
        this.take();
        return { type: 'string', value: token.text, start: token.start, end: token.end };
      case 'field':
        this.take();
        return { type: 'field', name: token.text, start: token.start, end: token.end };
      case 'parameter':
        this.take();
        return { type: 'parameter', name: token.text, start: token.start, end: token.end };
      case '(': {
        this.take();
        const inner = this.or();
        this.expect(')', ')');
        return inner;
      }
      case '[':
        return this.list();
      case 'name':
        return this.name();
      default:
        throw new ExpressionSyntaxError(
          token.kind === 'end' ? 'The expression ends too soon' : `Unexpected ${token.text}`,
          token.start
        );
    }
  }

  private name(): ExpressionNode {
    const token = this.take();
    if (this.peek().kind !== '(') {
      // A bare word: a calc level, a sort order, a literal, or a column written without braces.
      const upper = token.text.toUpperCase();
      return KEYWORDS.has(upper)
        ? { type: 'keyword', name: upper, start: token.start, end: token.end }
        : { type: 'field', name: token.text, start: token.start, end: token.end };
    }
    this.take();
    const args: ExpressionNode[] = [];
    if (this.peek().kind !== ')') {
      args.push(this.or());
      while (this.peek().kind === ',') {
        this.take();
        args.push(this.or());
      }
    }
    const close = this.expect(')', `) to close ${token.text}(`);
    return { type: 'call', name: token.text, args, start: token.start, end: close.end };
  }

  private list(): ExpressionNode {
    const open = this.take();
    const items: Array<{ expression: ExpressionNode; order?: 'ASC' | 'DESC' }> = [];
    if (this.peek().kind !== ']') {
      do {
        if (this.peek().kind === ',') this.take();
        const expression = this.or();
        const order = this.isWord('ASC') ? 'ASC' : this.isWord('DESC') ? 'DESC' : undefined;
        if (order) this.take();
        items.push(order ? { expression, order } : { expression });
      } while (this.peek().kind === ',');
    }
    const close = this.expect(']', ']');
    return { type: 'list', items, start: open.start, end: close.end };
  }
}

/** Bare words that are not columns. */
const KEYWORDS = new Set([
  'PRE_FILTER',
  'PRE_AGG',
  'POST_AGG_FILTER',
  'ASC',
  'DESC',
  'NULL',
  'TRUE',
  'FALSE',
]);

export function parseExpression(source: string): ParseResult {
  try {
    return { ok: true, ast: new Parser(tokenize(source)).parse() };
  } catch (error) {
    if (error instanceof ExpressionSyntaxError) {
      return { ok: false, error: { message: error.message, position: error.position } };
    }
    throw error;
  }
}

/** Every node, parents before children. */
export function walkExpression(node: ExpressionNode, visit: (node: ExpressionNode) => void): void {
  visit(node);
  switch (node.type) {
    case 'call':
      for (const arg of node.args) walkExpression(arg, visit);
      break;
    case 'list':
      for (const item of node.items) walkExpression(item.expression, visit);
      break;
    case 'unary':
      walkExpression(node.arg, visit);
      break;
    case 'binary':
      walkExpression(node.left, visit);
      walkExpression(node.right, visit);
      break;
    default:
      break;
  }
}
