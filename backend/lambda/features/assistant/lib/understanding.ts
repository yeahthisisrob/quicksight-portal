/**
 * The first thing the assistant does with a message: say what it understood
 * and sort the ask, in one quick, cheap model call. The sentence goes to the
 * person at once (they see it while the work runs, and again at the top of
 * the answer), and a visual change to a named analysis or dashboard goes
 * straight to the planner with no conversation rounds in between.
 *
 * Routing first with a fast call, then one planning call, is the pattern
 * that replaces a think-act-think loop for well-specified asks.
 */
import { type VocabularyEntry, vocabularySection } from '../../../shared/ai/authoringVocabulary';
import type { ChatModel, ChatTool, ChatTurn } from '../services/ChatModel';
import type { ChatHistoryMessage } from '../types';
import { conversationOf } from './conversation';

export interface UnderstoodFilter {
  column: string;
  dataset?: string;
  control?: string;
  placement?: string;
  /** A numeric filter's range, when the person gave one. */
  min?: number;
  max?: number;
}

/**
 * Where a filter goes, as far as the person said: every sheet or the ones
 * named, every visual or the ones named. What they did not say is undefined,
 * and the asset's own outline settles it or it is asked.
 */
export interface FilterScope {
  sheets?: 'all' | string[];
  visuals?: 'all' | string[];
}

export interface Understanding {
  /** One or two sentences to the person: what they want and what happens next. */
  understanding: string;
  /**
   * `visual`: a visual or layout change to one existing asset, keeping its
   * data. `filter`: only filters added to one existing asset, which code
   * places without a planner. `learn`: read what one asset is for.
   */
  change: 'visual' | 'filter' | 'learn' | 'other';
  /** For a visual change: the asset as the person named it. */
  asset?: { kind: 'dashboard' | 'analysis'; name: string; id?: string };
  /** For a visual change: a short title for the plan. */
  title?: string;
  /** For a visual change: exactly what changes, for the planner. */
  brief?: string;
  filters: UnderstoodFilter[];
  /** For a filter change: the sheets and visuals the person named, if any. */
  scope?: FilterScope;
  /** Only when the person said so: on a copy (clone) or in place (update). */
  editMode?: 'clone' | 'update';
}

export interface Understood {
  understanding: Understanding;
  usage: { inputTokens: number; outputTokens: number };
}

/** Reads the conversation and says what it understood; undefined when it could not. */
export type Understander = (
  history: ChatHistoryMessage[],
  context: string
) => Promise<Understood | undefined>;

export const UNDERSTAND_TOOL: ChatTool = {
  name: 'understand',
  description: 'What the person wants, said back to them, and how the ask is sorted.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'understanding',
      'change',
      'asset',
      'title',
      'brief',
      'filters',
      'scope',
      'editMode',
    ],
    properties: {
      understanding: {
        type: 'string',
        description:
          'One or two sentences to the person, present tense, plain words: what they want, e.g. "Adding a table of every result at the bottom of Sales review." or "Adding a Region filter to Sales review." Never a question, never an offer, never a promise of what comes next.',
      },
      change: {
        type: 'string',
        enum: ['visual', 'filter', 'learn', 'other'],
        description:
          'filter: the person asks ONLY for one or more filters (or filter controls) on columns, added to ONE existing analysis or dashboard they named or the conversation is about, and nothing else. visual: any other visual or layout change to ONE existing analysis or dashboard (add, move, resize, retype, retitle or remove a visual; a filter together with a visual), keeping the data it reads. learn: the person asks the assistant to learn, study, understand or document what ONE existing analysis or dashboard is for, and to ask them what it cannot tell. other: everything else - a question, a new analysis or dashboard, a dataset, pointing at other data, tags, sharing, a fact they state about something, or anything unclear.',
      },
      asset: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'name', 'id'],
        properties: {
          kind: { type: 'string', enum: ['', 'dashboard', 'analysis'] },
          name: { type: 'string', description: 'As the person named it; "" when none.' },
          id: { type: 'string', description: 'Its id when the conversation gave one; else "".' },
        },
        description:
          'visual or learn: the analysis or dashboard. Otherwise kind "", name "", id "".',
      },
      title: {
        type: 'string',
        description:
          'visual: a short title for the plan, e.g. "Results table on Sales review"; else "".',
      },
      brief: {
        type: 'string',
        description:
          'visual: exactly what changes, for the planner: each visual with its type and the columns it shows in the person\'s words, where it goes (the bottom of the sheet, beside X), each filter with its control and placement, and nothing the person did not ask for. Else "".',
      },
      editMode: {
        type: 'string',
        enum: ['', 'copy', 'inPlace'],
        description:
          'Only when the person explicitly said the change goes on a copy ("make a copy", "a new version") or in place ("change it directly", "the original"); "" otherwise - Settings decide.',
      },
      filters: {
        type: 'array',
        description: 'Every filter the person asked for; [] when none.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['column', 'dataset', 'control', 'placement', 'min', 'max'],
          properties: {
            column: { type: 'string' },
            dataset: { type: 'string', description: 'The dataset name when said; else "".' },
            control: {
              type: 'string',
              description:
                'dropdown, singleSelect, list, slider, dateRange, relativeDate or "" when not said.',
            },
            placement: { type: 'string', description: 'controlBar, canvas or "".' },
            min: {
              type: 'string',
              description: 'A number filter\'s lower bound when the person gave a range; else "".',
            },
            max: { type: 'string', description: 'Its upper bound when given; else "".' },
          },
        },
      },
      scope: {
        type: 'object',
        additionalProperties: false,
        required: ['sheets', 'sheetNames', 'visuals', 'visualNames'],
        description:
          'filter only: where the person said the filters go. Everything "" and [] otherwise, and whenever they did not say.',
        properties: {
          sheets: {
            type: 'string',
            enum: ['', 'all', 'named'],
            description:
              '"all" when they said every sheet, all sheets or the whole analysis or dashboard; "named" when they named sheets or tabs; "" when they did not say.',
          },
          sheetNames: { type: 'array', items: { type: 'string' } },
          visuals: {
            type: 'string',
            enum: ['', 'all', 'named'],
            description:
              '"all" when they said every visual, all visuals, all charts or everything; "named" when they named visuals or charts; "" when they did not say.',
          },
          visualNames: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const RULES = [
  'You are the first reader of a message to the assistant inside a QuickSight Assets Portal, which helps analysts find QuickSight assets and governed data and build or change datasets, analyses and dashboards. Nothing has run yet. Say what you understood and sort the ask.',
  `Answer only by calling the ${UNDERSTAND_TOOL.name} tool, exactly once. Do not answer in prose.`,
  'The understanding is said to the person before any work starts, so it must be what they will see happen: name the asset and the change in their words. When the ask is unclear, say what you take it to mean; a question is never asked here.',
  'A visual change keeps the asset reading the datasets it reads today. Asking for other data, a new asset, or a copy onto other datasets is not one.',
  "When the last message answers a question the assistant asked (which sheets, which visuals, which dataset), it continues the ask before it: sort that ask, with the answer's words as its scope.",
].join('\n');

/** The stable part of the prompt: the rules and the organisation\'s own words. */
export function understandSystem(vocabulary?: VocabularyEntry[]): string {
  return [RULES, vocabularySection(vocabulary)].filter(Boolean).join('\n\n');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The tool input as an understanding, or undefined when it is not one. */
export function parseUnderstanding(input: Record<string, unknown>): Understanding | undefined {
  const understanding = text(input.understanding);
  if (!understanding) return undefined;
  const asset = (input.asset ?? {}) as Record<string, unknown>;
  const kind = text(asset.kind);
  const name = text(asset.name);
  const named = (kind === 'dashboard' || kind === 'analysis') && name !== '';
  if (input.change === 'learn' && named) {
    return {
      understanding,
      change: 'learn',
      asset: { kind, name, ...(text(asset.id) ? { id: text(asset.id) } : {}) },
      filters: [],
    };
  }
  const filters = (Array.isArray(input.filters) ? input.filters : [])
    .map((f: any) => {
      const [min, max] = [bound(f?.min), bound(f?.max)];
      return {
        column: text(f?.column),
        ...(text(f?.dataset) ? { dataset: text(f.dataset) } : {}),
        ...(text(f?.control) ? { control: text(f.control) } : {}),
        ...(text(f?.placement) ? { placement: text(f.placement) } : {}),
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      };
    })
    .filter((f) => f.column);
  // A filter-only ask with no filter named is a visual change for the planner to read.
  const filter = input.change === 'filter' && named && filters.length > 0;
  const visual = (input.change === 'visual' || input.change === 'filter') && named;
  if (!visual) {
    return { understanding, change: 'other', filters };
  }
  const editMode =
    input.editMode === 'copy' ? 'clone' : input.editMode === 'inPlace' ? 'update' : undefined;
  return {
    understanding,
    change: filter ? 'filter' : 'visual',
    asset: { kind, name, ...(text(asset.id) ? { id: text(asset.id) } : {}) },
    ...(text(input.title) ? { title: text(input.title) } : {}),
    ...(text(input.brief) ? { brief: text(input.brief) } : {}),
    filters,
    ...(filter ? { scope: scopeOf(input.scope) } : {}),
    ...(editMode ? { editMode } : {}),
  };
}

/** A bound the model wrote as text, as a number; undefined when it is not one. */
function bound(value: unknown): number | undefined {
  const raw = typeof value === 'number' ? value : text(value) ? Number(text(value)) : Number.NaN;
  return Number.isFinite(raw) ? raw : undefined;
}

/** The scope as said: all, the names given, or nothing. */
function scopeOf(raw: unknown): FilterScope {
  const s = (raw ?? {}) as Record<string, unknown>;
  const names = (value: unknown) =>
    (Array.isArray(value) ? value : []).map(text).filter((n) => n !== '');
  const part = (mode: unknown, list: unknown): 'all' | string[] | undefined =>
    mode === 'all' ? 'all' : mode === 'named' && names(list).length ? names(list) : undefined;
  const sheets = part(s.sheets, s.sheetNames);
  const visuals = part(s.visuals, s.visualNames);
  return { ...(sheets ? { sheets } : {}), ...(visuals ? { visuals } : {}) };
}

/**
 * An understander on a chat model: the conversation and the page's working
 * state go in, with the model asked to think as little as it can.
 */
export function understandWith(chat: ChatModel, vocabulary?: VocabularyEntry[]): Understander {
  const stable = understandSystem(vocabulary);
  return async (history, context) => {
    const turns: ChatTurn[] = conversationOf(history).map((m) =>
      m.role === 'user'
        ? { role: 'user', text: m.text }
        : { role: 'assistant', text: m.text, toolCalls: [] }
    );
    const turn = await chat.turn(
      { stable, ...(context ? { context } : {}) },
      turns,
      [UNDERSTAND_TOOL],
      { effort: 'low' }
    );
    const call = turn.toolCalls.find((c) => c.name === UNDERSTAND_TOOL.name);
    const understanding = call ? parseUnderstanding(call.input) : undefined;
    return understanding ? { understanding, usage: turn.usage } : undefined;
  };
}
