/**
 * What kind of calculation an expression is, and where QuickSight evaluates
 * it: the kind (row-level, aggregate, LAC-A, LAC-W, table calculation), its
 * stage in the order of evaluation, the calc level it asks for, and whether
 * SPICE materialises it at ingestion (row-level and no parameter) or it has
 * to be computed at query time.
 *
 * The expression is parsed (./expressionParser), so each function's own
 * arguments decide: `sum({x}, [{region}])` is LAC-A, `sumOver(..., PRE_AGG)`
 * is LAC-W before aggregation, `sumOver(...)` with no level is a table
 * calculation. Functions come from ./quicksightFunctions (the AWS docs).
 * An expression that does not parse is still classified from the function
 * names it calls, and says so.
 */
import { type ExpressionNode, parseExpression, tokenize, walkExpression } from './expressionParser';
import {
  type CalcLevel,
  EVALUATION_ORDER,
  type FunctionKind,
  QUICKSIGHT_FUNCTIONS,
  type QuickSightFunction,
} from './quicksightFunctions';

export { EVALUATION_ORDER, ORDER_OF_EVALUATION_URL } from './quicksightFunctions';

export type FieldKind = 'row-level' | 'aggregate' | 'lac-a' | 'lac-w' | 'table-calc';

export type EvaluationStageId = (typeof EVALUATION_ORDER)[number]['id'];

export interface ExpressionVerdict {
  kind: FieldKind;
  /** Its stage in QuickSight's order of evaluation (the latest any part of it needs). */
  stage: EvaluationStageId;
  /** The calc level a LAC-W or table calculation runs at. */
  calcLevel?: CalcLevel;
  /** SPICE computes it once at ingestion: row-level and reads no parameter. */
  materialisable: boolean;
  /** The known functions it calls, once each. */
  functions: Array<{ name: string; kind: FunctionKind; docUrl: string }>;
  /** Called names the catalog does not know. */
  unknownFunctions: string[];
  /** Fields and columns it reads, once each. */
  fields: string[];
  parameters: string[];
  /** Why it is what it is, in plain words. */
  reasons: string[];
  /** Present when the expression did not parse; the rest is from the names it calls. */
  error?: { message: string; position: number };
}

const BY_NAME = new Map(QUICKSIGHT_FUNCTIONS.map((f) => [f.name.toLowerCase(), f]));

export function functionNamed(name: string): QuickSightFunction | undefined {
  return BY_NAME.get(name.toLowerCase());
}

const STAGE_OF: Record<FieldKind, EvaluationStageId> = {
  'row-level': 'simple-calculations',
  aggregate: 'visual-aggregations',
  'lac-a': 'lac-a',
  'lac-w': 'lac-w-pre-agg',
  'table-calc': 'table-calculations',
};

const STAGE_RANK = new Map(EVALUATION_ORDER.map((s, i) => [s.id, i]));
const rank = (stage: EvaluationStageId) => STAGE_RANK.get(stage) ?? 0;

const CALC_LEVELS = new Set<string>(['PRE_FILTER', 'PRE_AGG', 'POST_AGG_FILTER']);
/** What a level-aware window does when no level is given. */
const DEFAULT_WINDOW_LEVEL: CalcLevel = 'POST_AGG_FILTER';

interface Placed {
  kind: FieldKind;
  stage: EvaluationStageId;
  calcLevel?: CalcLevel;
  reason?: string;
}

/** One call's place, from the function and its own arguments. */
function placeCall(fn: QuickSightFunction, args: ExpressionNode[] | undefined): Placed {
  if (fn.kind === 'scalar') return { kind: 'row-level', stage: STAGE_OF['row-level'] };
  if (fn.kind === 'aggregate') {
    const partitioned = fn.lacA && args?.some((a) => a.type === 'list');
    return partitioned
      ? { kind: 'lac-a', stage: 'lac-a', reason: `${fn.name} with its own group-by level (LAC-A)` }
      : {
          kind: 'aggregate',
          stage: STAGE_OF.aggregate,
          reason: `${fn.name} aggregates by the visual`,
        };
  }
  const given = args
    ?.map((a) => (a.type === 'keyword' && CALC_LEVELS.has(a.name) ? (a.name as CalcLevel) : null))
    .find(Boolean);
  // No level given: the documented default, else post-aggregation where the
  // function allows it, else the latest level it does allow.
  const level: CalcLevel =
    given ??
    fn.defaultCalcLevel ??
    (!fn.calcLevels || fn.calcLevels.includes(DEFAULT_WINDOW_LEVEL)
      ? DEFAULT_WINDOW_LEVEL
      : fn.calcLevels[fn.calcLevels.length - 1]!);
  if (level === 'PRE_FILTER' || level === 'PRE_AGG') {
    return {
      kind: 'lac-w',
      stage: level === 'PRE_FILTER' ? 'lac-w-pre-filter' : 'lac-w-pre-agg',
      calcLevel: level,
      reason: `${fn.name} at ${level} (LAC-W)`,
    };
  }
  return {
    kind: 'table-calc',
    stage: STAGE_OF['table-calc'],
    calcLevel: level,
    reason: `${fn.name} runs over the aggregated result`,
  };
}

interface Options {
  /**
   * The verdict of a field it reads, when that field is itself calculated:
   * `{margin}` over an aggregate is evaluated no earlier than the aggregate.
   */
  kindOf?: (
    field: string
  ) => Pick<ExpressionVerdict, 'kind' | 'stage' | 'materialisable'> | undefined;
}

/** Called names from tokens alone, for an expression that does not parse. */
function callsFromTokens(expression: string): Array<{ name: string }> {
  try {
    const tokens = tokenize(expression);
    return tokens
      .filter((t, i) => t.kind === 'name' && tokens[i + 1]?.kind === '(')
      .map((t) => ({ name: t.text }));
  } catch {
    return [];
  }
}

export function classifyExpression(expression: string, options: Options = {}): ExpressionVerdict {
  const parsed = parseExpression(expression);
  const calls: Array<{ name: string; args?: ExpressionNode[] }> = [];
  const fields: string[] = [];
  const parameters: string[] = [];
  if (parsed.ok) {
    walkExpression(parsed.ast, (node) => {
      if (node.type === 'call') calls.push({ name: node.name, args: node.args });
      else if (node.type === 'field' && !fields.includes(node.name)) fields.push(node.name);
      else if (node.type === 'parameter' && !parameters.includes(node.name)) {
        parameters.push(node.name);
      }
    });
  } else {
    calls.push(...callsFromTokens(expression));
  }

  let placed: Placed = { kind: 'row-level', stage: STAGE_OF['row-level'] };
  const reasons: string[] = [];
  const functions: ExpressionVerdict['functions'] = [];
  const unknownFunctions: string[] = [];
  const consider = (next: Placed) => {
    if (next.reason && !reasons.includes(next.reason)) reasons.push(next.reason);
    if (rank(next.stage) > rank(placed.stage)) placed = next;
  };
  for (const call of calls) {
    const fn = functionNamed(call.name);
    if (!fn) {
      if (!unknownFunctions.includes(call.name)) unknownFunctions.push(call.name);
      continue;
    }
    if (!functions.some((f) => f.name === fn.name)) {
      functions.push({ name: fn.name, kind: fn.kind, docUrl: fn.docUrl });
    }
    consider(placeCall(fn, call.args));
  }
  let readsQueryTimeField = false;
  for (const field of fields) {
    const upstream = options.kindOf?.(field);
    if (!upstream) continue;
    if (!upstream.materialisable) readsQueryTimeField = true;
    if (upstream.kind !== 'row-level') {
      consider({
        kind: upstream.kind,
        stage: upstream.stage,
        reason: `reads ${field} (${upstream.kind})`,
      });
    }
  }
  for (const parameter of parameters) reasons.push(`reads parameter ${parameter}`);

  return {
    kind: placed.kind,
    stage: placed.stage,
    ...(placed.calcLevel ? { calcLevel: placed.calcLevel } : {}),
    materialisable: placed.kind === 'row-level' && parameters.length === 0 && !readsQueryTimeField,
    functions,
    unknownFunctions,
    fields,
    parameters,
    reasons,
    ...(parsed.ok ? {} : { error: parsed.error }),
  };
}

/**
 * Every calculated field of a set (a dataset's, or an analysis's), each
 * classified with the fields it reads resolved within the set, so a field
 * over an aggregate is an aggregate too. A cycle is broken, not followed.
 */
export function classifyFields(
  fields: Array<{ name: string; expression?: string | null }>
): Map<string, ExpressionVerdict> {
  const byName = new Map(
    fields.filter((f) => f.expression).map((f) => [f.name, String(f.expression)])
  );
  const verdicts = new Map<string, ExpressionVerdict>();
  const visiting = new Set<string>();
  const verdictOf = (name: string): ExpressionVerdict | undefined => {
    const expression = byName.get(name);
    if (expression === undefined || visiting.has(name)) return verdicts.get(name);
    if (!verdicts.has(name)) {
      visiting.add(name);
      verdicts.set(name, classifyExpression(expression, { kindOf: verdictOf }));
      visiting.delete(name);
    }
    return verdicts.get(name);
  };
  for (const name of byName.keys()) verdictOf(name);
  return verdicts;
}

/**
 * Where each function call's name sits in an expression, with its docs
 * link when the catalog knows it: for highlighting and linking the text.
 * Names inside strings and field names are never matched.
 */
export function functionSpans(
  expression: string
): Array<{ name: string; start: number; end: number; docUrl?: string }> {
  let tokens: ReturnType<typeof tokenize>;
  try {
    tokens = tokenize(expression);
  } catch {
    return [];
  }
  return tokens
    .filter((t, i) => t.kind === 'name' && tokens[i + 1]?.kind === '(')
    .map((t) => {
      const docUrl = functionNamed(t.text)?.docUrl;
      return { name: t.text, start: t.start, end: t.end, ...(docUrl ? { docUrl } : {}) };
    });
}
