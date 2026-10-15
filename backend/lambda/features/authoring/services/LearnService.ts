/**
 * Learn what an analysis or dashboard is for: one model call over its
 * outline and the columns it reads, drafting a reading of the asset and of
 * each visual, and listing what the definition cannot tell (an unnamed KPI,
 * a column whose meaning is ambiguous, a filter with no obvious reason).
 * The readings are kept as draft notes on the asset and its visuals, the
 * unknowns as open questions, all by the graph's ids, so a person can
 * confirm or answer them once and the planner knows from then on.
 *
 * What the definition does show is written by code, not the model: the
 * visual's type, fields and filters are facts the outline already carries.
 */
import { assetEntityId, visualEntityId } from '../../../shared/services/knowledge/entityIds';
import {
  knowledge as defaultStore,
  type KnowledgeStore,
  type Note,
} from '../../../shared/services/knowledge/KnowledgeStore';
import {
  knowledgeBlock,
  PLANNER_NOTE_KINDS,
} from '../../../shared/services/knowledge/knowledgeLines';
import { logger } from '../../../shared/utils/logger';
import type { SheetOutline } from '../lib/definitionOutline';
import type { AuthorableAssetType } from '../types';
import type { PlannerModel } from './planner/PlannerModel';
import type { RebindService } from './RebindService';

export interface LearnResult {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  /** What the model read into the asset and its visuals, as draft notes. */
  drafts: Note[];
  /** What it could not tell from the definition, as open questions. */
  questions: Note[];
  /** How many confirmed notes were already there, and were read first. */
  known: number;
  model: { provider: string; model: string };
}

const MAX_QUESTIONS = 6;
const MAX_COLUMNS_PER_DATASET = 60;
const LEARN_MAX_TOKENS = 3_000;

const LEARN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['asset', 'visuals', 'questions'],
  properties: {
    asset: {
      type: 'string',
      description:
        'One or two sentences on what this asset is for and who would read it, from what it shows. "" when nothing can be said.',
    },
    visuals: {
      type: 'array',
      description: 'One line per visual worth describing, in the words a colleague would use.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['elementId', 'description'],
        properties: {
          elementId: { type: 'string', description: 'From the outline.' },
          description: { type: 'string' },
        },
      },
    },
    questions: {
      type: 'array',
      description: `What the definition cannot tell and a person could, at most ${MAX_QUESTIONS}: an unnamed number, a column whose meaning is ambiguous, a filter or threshold with no obvious reason. Never ask what the outline already shows.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['elementId', 'question'],
        properties: {
          elementId: {
            type: 'string',
            description:
              'The visual it is about, from the outline; "" when it is about the asset as a whole.',
          },
          question: { type: 'string' },
        },
      },
    },
  },
} as const;

const SYSTEM = [
  'You read the outline of a QuickSight analysis or dashboard and say what it is for, as a colleague would: who reads it, what question each visual answers. Facts come from the outline and the columns; where a purpose cannot be told from them, ask instead of guessing.',
  'Answer only by calling the learn tool, exactly once. Say nothing that merely repeats a visual type or its field names; say what the numbers mean to the business when that can be told, and ask when it cannot.',
].join('\n');

function visualsOf(outline: SheetOutline[]): Array<{ elementId: string; title?: string }> {
  return outline.flatMap((s) =>
    s.elements
      .filter((e) => e.kind === 'visual')
      .map((e) => ({ elementId: e.elementId, title: e.title }))
  );
}

export class LearnService {
  public constructor(
    private readonly rebind: RebindService,
    private readonly model: PlannerModel,
    private readonly store: KnowledgeStore = defaultStore
  ) {}

  public async learn(assetType: AuthorableAssetType, assetId: string): Promise<LearnResult> {
    const [outline, described] = await Promise.all([
      this.rebind.loadDefinitionOutline(assetType, assetId),
      this.rebind.describeDatasets(assetType, assetId),
    ]);
    const asset = assetEntityId(assetType, assetId);
    const visuals = visualsOf(outline);
    const visualIds = new Map(
      visuals.map((v) => [v.elementId, visualEntityId(assetType, assetId, v.elementId)])
    );
    const entityIds = [asset, ...visualIds.values()];
    const known = await this.store.confirmedFor(entityIds);
    const knownCount = [...known.values()].reduce((sum, notes) => sum + notes.length, 0);
    const datasets = await Promise.all(
      described.datasets.map(async (d) => {
        const target = await this.rebind.describeTargetDataset(d.dataSetId).catch(() => null);
        return {
          identifier: d.identifier,
          columns: (target?.columns ?? d.columns)
            .slice(0, MAX_COLUMNS_PER_DATASET)
            .map((c: any) => `${c.name}${c.type ? ` (${c.type})` : ''}`),
        };
      })
    );
    const user = [
      `The ${assetType} "${described.name}". Its sheets and visuals, with the ids you must use:`,
      JSON.stringify(outline),
      '',
      'The datasets it reads, by identifier, with their columns:',
      JSON.stringify(datasets),
      knownBlock(known, visuals, described.name, assetType),
      '',
      'Describe the asset and each visual, and list what you cannot tell.',
    ]
      .filter((line) => line !== null)
      .join('\n');
    const result = await this.model.complete({
      label: 'learn',
      system: SYSTEM,
      user,
      schemaName: 'learn',
      schemaDescription: 'What the asset and its visuals are for, and the open questions.',
      schema: LEARN_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: LEARN_MAX_TOKENS,
    });
    const output = (result.output ?? {}) as Record<string, unknown>;
    const by = result.model || result.provider;

    // A fresh reading replaces the model's earlier one; a person's notes are never touched.
    await this.forgetDrafts(entityIds);

    const drafts: Note[] = [];
    const questions: Note[] = [];
    const assetText = typeof output.asset === 'string' ? output.asset.trim() : '';
    if (assetText) {
      drafts.push(
        await this.store.add({
          entityId: asset,
          kind: 'description',
          text: assetText,
          source: 'model',
          status: 'draft',
          by,
        })
      );
    }
    for (const item of Array.isArray(output.visuals) ? output.visuals : []) {
      const entityId = visualIds.get(String(item?.elementId ?? ''));
      const text = typeof item?.description === 'string' ? item.description.trim() : '';
      if (!entityId || !text) continue;
      drafts.push(
        await this.store.add({
          entityId,
          kind: 'description',
          text,
          source: 'model',
          status: 'draft',
          by,
        })
      );
    }
    for (const item of (Array.isArray(output.questions) ? output.questions : []).slice(
      0,
      MAX_QUESTIONS
    )) {
      const about = String(item?.elementId ?? '');
      const entityId = about ? visualIds.get(about) : asset;
      const text = typeof item?.question === 'string' ? item.question.trim() : '';
      if (!entityId || !text) continue;
      questions.push(
        await this.store.add({
          entityId,
          kind: 'question',
          text,
          source: 'model',
          status: 'draft',
          by,
        })
      );
    }
    logger.info('Learned an asset', {
      assetType,
      assetId,
      drafts: drafts.length,
      questions: questions.length,
      known: knownCount,
    });
    return {
      assetType,
      assetId,
      name: described.name,
      drafts,
      questions,
      known: knownCount,
      model: { provider: result.provider, model: result.model },
    };
  }

  /** The model's earlier drafts and questions on these entities, gone before it reads again. */
  private async forgetDrafts(entityIds: string[]): Promise<void> {
    for (const entityId of entityIds) {
      const drafts = await this.store.list(entityId, { status: 'draft' }).catch(() => [] as Note[]);
      await Promise.all(
        drafts
          .filter((n) => n.source === 'model')
          .map((n) => this.store.remove(entityId, n.noteId).catch(() => undefined))
      );
    }
  }
}

/** What is already confirmed about the asset and its visuals, so the model builds on it and never asks it again. */
function knownBlock(
  known: Map<string, Note[]>,
  visuals: Array<{ elementId: string; title?: string }>,
  name: string,
  assetType: string
): string | null {
  const titles = new Map(visuals.map((v) => [v.elementId, v.title]));
  const block = knowledgeBlock(known, {
    kinds: PLANNER_NOTE_KINDS,
    label: (id) => {
      const visualId = id.split(':').pop() ?? '';
      return id.startsWith('visual:')
        ? `Visual "${titles.get(visualId) ?? visualId}" (${visualId})`
        : `The ${assetType} "${name}"`;
    },
  });
  return block ? `\n${block}\nDo not ask about any of this; build on it.` : null;
}
