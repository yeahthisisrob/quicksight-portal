/**
 * When no candidate has every column by name, a model is shown what the
 * asset uses and the closest candidates' columns, with the SMUS
 * descriptions of the governed ones, and asked for one candidate and a
 * column for each name. What it answers is only a proposal: a candidate it
 * was not offered, a column the candidate does not have, or a name left
 * unmapped means review, and so does any mapping below the confidence asked
 * for. The rebind's own dry run checks the rest.
 */
import type { InferRequest, PlaybookContext } from '../types';
import { type DatasetRef, governedColumns, type SpecSession } from './session';

export interface Offered {
  to: DatasetRef;
  columns: Array<{ name: string; type?: string }>;
}

export interface InferredMatch {
  to: DatasetRef;
  columnMap: Record<string, string>;
  confidence: number;
  notes: string[];
}

interface Answer {
  candidateId: string;
  mappings: Array<{ from: string; to: string | null; confidence: number; why?: string }>;
}

const MAX_TOKENS = 2000;
const DESCRIPTION_MAX = 160;

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['candidateId', 'mappings'],
  properties: {
    candidateId: { type: 'string' },
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'confidence'],
        properties: {
          from: { type: 'string' },
          to: { type: ['string', 'null'] },
          confidence: { type: 'number' },
          why: { type: 'string' },
        },
      },
    },
  },
};

async function describeCandidate(
  session: SpecSession,
  ctx: PlaybookContext,
  offered: Offered
): Promise<string> {
  const described = new Map(
    (await governedColumns(session, ctx, offered.to.id)).map((c) => [
      c.name.toLowerCase(),
      c.description,
    ])
  );
  const lines = offered.columns.map((c) => {
    const note = described.get(c.name.toLowerCase());
    return `  - ${c.name}${c.type ? ` (${c.type})` : ''}${note ? `: ${note.slice(0, DESCRIPTION_MAX)}` : ''}`;
  });
  return `Candidate ${offered.to.id} "${offered.to.name}":\n${lines.join('\n')}`;
}

export async function inferMatch(
  ctx: PlaybookContext,
  session: SpecSession,
  from: DatasetRef,
  used: string[],
  offered: Offered[],
  minConfidence: number
): Promise<{ match: InferredMatch | null; doubt: string }> {
  if (!ctx.infer || offered.length === 0) {
    return { match: null, doubt: 'no model was chosen to infer a mapping' };
  }
  const request: InferRequest = {
    label: 'playbook-match-dataset',
    system:
      'You map the columns a dashboard uses onto a replacement dataset. Choose the one candidate that best holds the same data, and for each used column name the candidate column holding the same values, or null when none does. Use the descriptions; never map on a similar-looking name alone. Confidence is 0 to 1.',
    user: [
      `The dashboard reads dataset "${from.name}" and uses these columns: ${used.join(', ')}.`,
      '',
      ...(await Promise.all(offered.map((o) => describeCandidate(session, ctx, o)))),
    ].join('\n'),
    schemaName: 'dataset_match',
    schemaDescription: 'The chosen candidate and a column for each used name',
    schema: SCHEMA,
    maxTokens: MAX_TOKENS,
  };
  const answer = (await ctx.infer(request)) as Answer;

  const chosen = offered.find((o) => o.to.id === answer?.candidateId);
  if (!chosen) {
    return {
      match: null,
      doubt: `the model chose ${answer?.candidateId ?? 'nothing'}, which was not offered`,
    };
  }
  const names = new Set(chosen.columns.map((c) => c.name));
  const columnMap: Record<string, string> = {};
  const notes: string[] = [];
  const problems: string[] = [];
  let confidence = 1;
  for (const name of used) {
    const mapping = answer.mappings?.find((m) => m.from === name);
    if (!mapping?.to) {
      problems.push(`${name} has no column in ${chosen.to.name}`);
      continue;
    }
    if (!names.has(mapping.to)) {
      problems.push(`${name} → ${mapping.to}, which ${chosen.to.name} does not have`);
      continue;
    }
    confidence = Math.min(confidence, Number(mapping.confidence) || 0);
    if (mapping.to !== name) {
      columnMap[name] = mapping.to;
      notes.push(`${name} → ${mapping.to}${mapping.why ? ` (${mapping.why})` : ''}`);
    }
  }
  if (problems.length > 0) {
    return { match: null, doubt: problems.join('; ') };
  }
  if (confidence < minConfidence) {
    return {
      match: null,
      doubt: `${chosen.to.name} fits with confidence ${confidence.toFixed(2)}, below ${minConfidence}: ${notes.join('; ')}`,
    };
  }
  return { match: { to: chosen.to, columnMap, confidence, notes }, doubt: '' };
}
