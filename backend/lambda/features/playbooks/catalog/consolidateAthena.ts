/**
 * Consolidate Athena data sources: every dataset reading through an Athena
 * data source other than the chosen one is pointed at the chosen one.
 *
 * An Athena data source is not tied to a catalog or database (the dataset's
 * tables name those), so in one account one is enough. What does differ
 * between two of them is the workgroup: it decides where results go, which
 * engine runs, what it may spend and how results are encrypted. A table
 * whose data source runs in another workgroup is left for review rather
 * than moved silently. Columns and table ids are untouched (the source
 * editor never rewrites them), so nothing downstream has to change.
 */
import type { CacheEntry } from '../../../shared/models/asset.model';
import type { Playbook, PlaybookContext } from '../types';
import { datasourceIdsOf, idFromArn, liveEntries } from './cache';

interface SourceTable {
  id: string;
  kind: string;
  dataSourceArn: string;
  name: string;
}

interface ChosenSource {
  id: string;
  arn: string;
  name: string;
  workGroup: string;
}

const ATHENA = 'ATHENA';

const tableCount = (n: number) => `${n} table${n === 1 ? '' : 's'}`;

function typeOf(entry: CacheEntry): string | undefined {
  return entry.metadata?.sourceType ?? entry.metadata?.datasourceType;
}

async function athenaSources(): Promise<Map<string, CacheEntry>> {
  const all = await liveEntries('datasource');
  return new Map(all.filter((d) => typeOf(d) === ATHENA).map((d) => [d.assetId, d]));
}

function chosen(ctx: PlaybookContext, athena: Map<string, CacheEntry>): ChosenSource {
  const id = String(ctx.params.target ?? '');
  const entry = athena.get(id);
  if (!entry?.arn) {
    throw new Error(`Choose an Athena data source to consolidate onto ('${id}' is not one)`);
  }
  return {
    id,
    arn: entry.arn,
    name: entry.assetName,
    workGroup: entry.metadata?.workGroup ?? 'primary',
  };
}

export const consolidateAthena: Playbook = {
  id: 'consolidate-athena',
  title: 'Consolidate Athena data sources',
  description:
    'Point every dataset that reads through another Athena data source at the one you choose. Columns and downstream dashboards are untouched; tables whose data source runs in a different workgroup are left for you to review.',
  category: 'data',
  params: [
    {
      key: 'target',
      label: 'Athena data source to keep',
      kind: 'datasource',
      dataSourceType: ATHENA,
      required: true,
      help: 'Every other Athena data source’s datasets move onto this one.',
    },
  ],
  writes: ['dataset'],

  async scope(ctx) {
    const athena = await athenaSources();
    const target = chosen(ctx, athena);
    const datasets = await liveEntries('dataset');
    return datasets
      .filter((dataset) =>
        datasourceIdsOf(dataset).some((id) => id !== target.id && athena.has(id))
      )
      .map((dataset) => ({
        assetType: 'dataset' as const,
        assetId: dataset.assetId,
        name: dataset.assetName,
        entry: dataset,
      }));
  },

  async plan(ctx, target) {
    const athena = await athenaSources();
    const keep = chosen(ctx, athena);
    const source = await ctx.call<{ tables: SourceTable[] }>(
      'GET',
      `/api/assets/dataset/${encodeURIComponent(target.assetId)}/source`
    );
    const moves: Array<{ table: SourceTable; from: CacheEntry }> = [];
    for (const table of source.tables) {
      const fromId = idFromArn(table.dataSourceArn);
      const from = fromId ? athena.get(fromId) : undefined;
      if (from && fromId !== keep.id && table.kind !== 'S3') {
        moves.push({ table, from });
      }
    }
    if (moves.length === 0) {
      return { verdict: 'skip', summary: `Already reads only through ${keep.name}` };
    }
    const changes = moves.map(
      ({ table, from }) => `${table.name}: ${from.assetName} → ${keep.name}`
    );
    const otherGroups = moves.filter(
      ({ from }) => (from.metadata?.workGroup ?? 'primary') !== keep.workGroup
    );
    if (otherGroups.length > 0) {
      const groups = [
        ...new Set(otherGroups.map(({ from }) => from.metadata?.workGroup ?? 'primary')),
      ];
      return {
        verdict: 'review',
        summary: `Reads through workgroup ${groups.join(', ')}; ${keep.name} runs in ${keep.workGroup}. Results location, engine and limits may differ.`,
        changes,
      };
    }
    return {
      verdict: 'change',
      summary: `${tableCount(moves.length)} to move onto ${keep.name}`,
      changes,
      data: {
        tables: moves.map(({ table }) => ({ id: table.id, dataSourceArn: keep.arn })),
        before: moves.map(({ table }) => ({ id: table.id, dataSourceArn: table.dataSourceArn })),
      },
    };
  },

  async apply(ctx, target, plan) {
    const { tables } = plan.data as { tables: Array<{ id: string; dataSourceArn: string }> };
    await ctx.call('PUT', `/api/assets/dataset/${encodeURIComponent(target.assetId)}/source`, {
      tables,
    });
    return { summary: `Moved ${tableCount(tables.length)}` };
  },
};
