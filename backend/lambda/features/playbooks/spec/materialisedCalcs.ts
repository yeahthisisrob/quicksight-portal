/**
 * Calculated fields the data now holds: a dashboard computes
 * `ifelse({status} = 'C', 1, 0)` while the governed dataset it reads has
 * gained `is_closed`, materialised upstream. This step finds each such
 * field and proposes pointing everything at the column and dropping the
 * field (the `replaceCalculatedField` op).
 *
 * Deciding that a column holds what an expression computes takes judgement,
 * so a name alone never changes anything: without a model a name match is
 * a suggestion for review; with one, the model reads each expression beside
 * the candidate columns and their governed descriptions and answers column
 * or none, with a confidence. A proposal counts only when the column is
 * there, the confidence clears the bar, and the rebind preview (a dry run
 * of the whole rewrite) accepts it.
 */

import { normalFieldName } from '../../../../../shared/lib/expressionPlacement';
import { authoringPath } from '../portalPaths';
import { type PlaybookContext, type PlaybookTarget, PortalCallError } from '../types';
import {
  DEFAULT_CALC_PREFIX,
  DEFAULT_DATASET_CALC_PREFIX,
  dryRun,
  withoutPrefix,
} from './calcHygiene';
import { resolve, resolveBoolean } from './inputs';
import { governedColumns, type SpecSession } from './session';
import type { StepPlan } from './steps';
import type { ReplaceMaterialisedStep } from './types';

interface CalcField {
  identifier: string;
  dataSetId: string;
  name: string;
  expression: string;
}

interface Proposal {
  field: CalcField;
  column: string;
  confidence: number;
  why?: string;
}

const DEFAULT_MIN_CONFIDENCE = 0.85;
const MAX_FIELDS = 30;
const MAX_COLUMNS = 80;
const DESCRIPTION_MAX = 160;
const MAX_TOKENS = 3000;
const RELATED_LIMIT = 200;
const NOT_FOUND = 404;

/** A calculated field's name without the organisation's prefixes, for a name match. */
const bare = (name: string, prefixes: string[]) => normalFieldName(withoutPrefix(name, prefixes));

/** The asset's calculated fields, each with its dataset and expression. */
async function calculatedFields(
  ctx: PlaybookContext,
  target: PlaybookTarget
): Promise<CalcField[]> {
  const [definition, related] = await Promise.all([
    ctx.call<{
      datasets: Array<{ identifier: string; dataSetId: string; calculatedFields: string[] }>;
    }>('GET', `${authoringPath(target)}/datasets`),
    ctx
      .call<{
        hits: Array<{ name: string; attributes: Record<string, unknown>; summary?: string }>;
      }>(
        'GET',
        `/api/context/entities/${encodeURIComponent(`${target.assetType}:${target.assetId}`)}/related?relations=defined-in&direction=in&types=calculated-field&limit=${RELATED_LIMIT}`
      )
      .catch((error) => {
        if (error instanceof PortalCallError && error.status === NOT_FOUND) return { hits: [] };
        throw error;
      }),
  ]);
  const expressions = new Map(
    (related.hits ?? []).map((h) => [h.name, String(h.attributes.expression ?? h.summary ?? '')])
  );
  return definition.datasets.flatMap((d) =>
    (d.calculatedFields ?? []).map((name) => ({
      identifier: d.identifier,
      dataSetId: d.dataSetId,
      name,
      expression: expressions.get(name) ?? '',
    }))
  );
}

async function askModel(
  ctx: PlaybookContext,
  session: SpecSession,
  fields: CalcField[],
  minConfidence: number
): Promise<{ proposals: Proposal[]; doubts: string[] }> {
  const byDataset = new Map<string, CalcField[]>();
  for (const f of fields) byDataset.set(f.dataSetId, [...(byDataset.get(f.dataSetId) ?? []), f]);
  const blocks: string[] = [];
  const columnsOf = new Map<string, Set<string>>();
  for (const [dataSetId, own] of byDataset) {
    const [{ name, columns }, described] = await Promise.all([
      session.columns(dataSetId),
      governedColumns(session, ctx, dataSetId),
    ]);
    columnsOf.set(dataSetId, new Set(columns.map((c) => c.name)));
    const notes = new Map(described.map((c) => [c.name.toLowerCase(), c.description]));
    blocks.push(
      [
        `Dataset ${dataSetId} "${name}" has these columns:`,
        ...columns.slice(0, MAX_COLUMNS).map((c) => {
          const note = notes.get(c.name.toLowerCase());
          return `  - ${c.name}${c.type ? ` (${c.type})` : ''}${note ? `: ${note.slice(0, DESCRIPTION_MAX)}` : ''}`;
        }),
        'Calculated fields defined over it:',
        ...own.map(
          (f) => `  - ${f.identifier}.${f.name} = ${f.expression || '(expression unknown)'}`
        ),
      ].join('\n')
    );
  }
  const answer = (await ctx.infer!({
    label: 'playbook-materialised-calcs',
    system:
      'You decide which calculated fields a dataset already holds as a column, so the field can be replaced by the column. Only answer a column when it holds the same values the expression computes, row for row; judge by the expression and the column descriptions, never by a similar name alone. When unsure, answer null. Confidence is 0 to 1.',
    user: blocks.join('\n\n'),
    schemaName: 'materialised_fields',
    schemaDescription: 'For each calculated field, the column that holds the same values, or null',
    schema: {
      type: 'object',
      required: ['fields'],
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            required: ['identifier', 'name', 'column', 'confidence'],
            properties: {
              identifier: { type: 'string' },
              name: { type: 'string' },
              column: { type: ['string', 'null'] },
              confidence: { type: 'number' },
              why: { type: 'string' },
            },
          },
        },
      },
    },
    maxTokens: MAX_TOKENS,
  })) as {
    fields?: Array<{
      identifier: string;
      name: string;
      column: string | null;
      confidence: number;
      why?: string;
    }>;
  };

  const proposals: Proposal[] = [];
  const doubts: string[] = [];
  for (const item of answer?.fields ?? []) {
    const field = fields.find((f) => f.identifier === item.identifier && f.name === item.name);
    if (!field || !item.column) continue;
    if (!columnsOf.get(field.dataSetId)?.has(item.column)) {
      doubts.push(`${field.name} → ${item.column}, which the dataset does not have`);
      continue;
    }
    const confidence = Number(item.confidence) || 0;
    if (confidence < minConfidence) {
      doubts.push(
        `${field.name} might be ${item.column} (confidence ${confidence.toFixed(2)}${item.why ? `: ${item.why}` : ''})`
      );
      continue;
    }
    proposals.push({
      field,
      column: item.column,
      confidence,
      ...(item.why ? { why: item.why } : {}),
    });
  }
  return { proposals, doubts };
}

/** Without a model: a column named like the field (its prefix aside) is a suggestion, never a change. */
async function nameMatches(session: SpecSession, fields: CalcField[], prefixes: string[]) {
  const doubts: string[] = [];
  for (const field of fields) {
    const { columns } = await session.columns(field.dataSetId);
    const match = columns.find(
      (c) => normalFieldName(c.name) === bare(field.name, prefixes) && c.name !== field.name
    );
    if (match)
      doubts.push(`${field.name} may be ${match.name} (a name match; check before replacing)`);
  }
  return doubts;
}

export async function planReplaceMaterialised(
  ctx: PlaybookContext,
  session: SpecSession,
  target: PlaybookTarget,
  step: ReplaceMaterialisedStep
): Promise<StepPlan> {
  const skip = (summary: string): StepPlan => ({
    kind: step.kind,
    verdict: 'skip',
    summary,
    changes: [],
  });
  if (target.assetType !== 'dashboard' && target.assetType !== 'analysis') {
    return skip('Applies to dashboards and analyses');
  }
  const governedOnly =
    step.governed === undefined ? true : resolveBoolean(step.governed, ctx.params);
  let fields = (await calculatedFields(ctx, target)).slice(0, MAX_FIELDS);
  if (governedOnly) {
    const governed = await Promise.all(fields.map((f) => session.governed(f.dataSetId)));
    fields = fields.filter((_, i) => governed[i]);
  }
  if (fields.length === 0) {
    return skip(
      governedOnly ? 'No calculated fields over a governed dataset' : 'No calculated fields'
    );
  }

  const prefixes = String(
    resolve(step.prefixes, ctx.params) ?? `${DEFAULT_DATASET_CALC_PREFIX},${DEFAULT_CALC_PREFIX}`
  )
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const minConfidence = Number(resolve(step.minConfidence, ctx.params)) || DEFAULT_MIN_CONFIDENCE;

  if (!resolveBoolean(step.infer, ctx.params) || !ctx.infer) {
    const doubts = await nameMatches(session, fields, prefixes);
    return doubts.length
      ? { kind: step.kind, verdict: 'review', summary: doubts.join('; '), changes: [] }
      : skip('No column looks like any of its calculated fields');
  }

  const { proposals, doubts } = await askModel(ctx, session, fields, minConfidence);
  if (proposals.length === 0) {
    return doubts.length
      ? { kind: step.kind, verdict: 'review', summary: doubts.join('; '), changes: [] }
      : skip('The data holds none of its calculated fields');
  }

  const ops = proposals.map((p) => ({
    op: 'replaceCalculatedField',
    identifier: p.field.identifier,
    name: p.field.name,
    column: p.column,
  }));
  const changes = proposals.map(
    (p) =>
      `Replace ${p.field.name} with ${p.column} (confidence ${p.confidence.toFixed(2)}${p.why ? `: ${p.why}` : ''})`
  );
  const refused = await dryRun(ctx, target, ops);
  if (refused) {
    return { kind: step.kind, verdict: 'review', summary: refused, changes };
  }
  // The sure ones go ahead; one left as a calculated field is harmless, and is named here.
  return {
    kind: step.kind,
    verdict: 'change',
    summary: `${proposals.length} calculated field${proposals.length === 1 ? '' : 's'} the data now holds${doubts.length ? `; left for review: ${doubts.join('; ')}` : ''}`,
    changes,
    data: { ops },
  };
}
