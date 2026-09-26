/**
 * Demo cleanup: the sample analyses, datasets and data sources QuickSight
 * creates in a new account (Sales Pipeline, People Overview, Business
 * Review, Web and Social Media Analytics, read from the spaceneedle sample
 * bucket). Analyses go first, then the datasets they read, then the data
 * sources; each is archived before it is deleted, and nothing is deleted
 * that something outside the sample set still reads.
 */
import type { CacheEntry } from '../../../shared/models/asset.model';
import type { AssetType } from '../../../shared/types/assetTypes';
import type { Playbook, PlaybookTarget, ScopedTarget } from '../types';
import { datasourceIdsOf, liveEntries } from './cache';

const SAMPLE_BUCKET = 'spaceneedle';
const REASON = 'Demo cleanup';
const MIN_MATCHING_FIELDS = 3;
const MIN_VISUALS = 5;
/** How many of the things still reading it a review row names. */
const READERS_NAMED = 3;

const DEMO_DATASET_FIELDS = [
  [
    'Salesperson',
    'Lead Name',
    'Opportunity Stage',
    'Weighted Revenue',
    'Forecasted Monthly Revenue',
  ],
  ['Employee Name', 'Employee ID', 'Monthly Compensation', 'Business Function', 'Job Family'],
  ['Customer ID', 'Customer Name', 'Service Line', 'Revenue Goal', 'Billed Amount'],
  [
    'Website Pageviews',
    'Website Visits',
    'Twitter mentions',
    'Twitter followers',
    'New visitors Social Media',
  ],
];
const DEMO_ANALYSES = new Set([
  'People Overview analysis',
  'Business Review analysis',
  'Sales Pipeline analysis',
  'Web and Social Media Analytics analysis',
]);
const DEMO_VISUAL_TITLES = [
  'Employees by Region',
  'Hiring by Region',
  'Gender diversity',
  'Historical  opportunity pipeline',
  'Revenues vs Goals',
  'Website pageviews and visits',
];
const STAGE: Partial<Record<AssetType, number>> = { analysis: 0, dataset: 1, datasource: 2 };

interface DemoSet {
  datasources: CacheEntry[];
  datasets: CacheEntry[];
  analyses: CacheEntry[];
  /** Everything else that reads a dataset or data source, for the "still in use" check. */
  dashboards: CacheEntry[];
  otherAnalyses: CacheEntry[];
  otherDatasets: CacheEntry[];
}

function isSampleSource(entry: CacheEntry): boolean {
  const type = entry.metadata?.sourceType ?? entry.metadata?.datasourceType;
  return type === 'S3' && Boolean(entry.metadata?.bucket?.includes(SAMPLE_BUCKET));
}

function looksLikeDemoDataset(entry: CacheEntry, sampleSources: Set<string>): boolean {
  if (datasourceIdsOf(entry).some((id) => sampleSources.has(id))) return true;
  const names = (entry.metadata?.fields ?? []).map((f) => f.fieldName);
  return DEMO_DATASET_FIELDS.some(
    (pattern) =>
      pattern.filter((field) => names.some((n) => n.includes(field))).length >= MIN_MATCHING_FIELDS
  );
}

function looksLikeDemoAnalysis(entry: CacheEntry): boolean {
  if (!DEMO_ANALYSES.has(entry.assetName)) return false;
  const sheet = entry.metadata?.sheets?.[0];
  const shaped =
    entry.metadata?.sheetCount === 1 &&
    sheet?.name === 'Sheet 1' &&
    (sheet?.visualCount ?? 0) >= MIN_VISUALS;
  const titles = (sheet?.visuals ?? []).map((v) => v.title ?? '');
  return shaped || titles.some((t) => DEMO_VISUAL_TITLES.some((p) => t.includes(p)));
}

async function findDemoSet(): Promise<DemoSet> {
  const [datasources, datasets, analyses, dashboards] = await Promise.all([
    liveEntries('datasource'),
    liveEntries('dataset'),
    liveEntries('analysis'),
    liveEntries('dashboard'),
  ]);
  const sampleSources = datasources.filter(isSampleSource);
  const sampleIds = new Set(sampleSources.map((d) => d.assetId));
  const demoDatasets = datasets.filter((d) => looksLikeDemoDataset(d, sampleIds));
  const demoAnalyses = analyses.filter(looksLikeDemoAnalysis);
  const demoAnalysisIds = new Set(demoAnalyses.map((a) => a.assetId));
  const demoDatasetIds = new Set(demoDatasets.map((d) => d.assetId));
  return {
    datasources: sampleSources,
    datasets: demoDatasets,
    analyses: demoAnalyses,
    dashboards,
    otherAnalyses: analyses.filter((a) => !demoAnalysisIds.has(a.assetId)),
    otherDatasets: datasets.filter((d) => !demoDatasetIds.has(d.assetId)),
  };
}

function readersOf(target: PlaybookTarget, demo: DemoSet): string[] {
  if (target.assetType === 'dataset') {
    return [...demo.dashboards, ...demo.otherAnalyses]
      .filter((e) => (e.metadata?.lineageData?.datasetIds ?? []).includes(target.assetId))
      .map((e) => `${e.assetType} "${e.assetName}"`);
  }
  if (target.assetType === 'datasource') {
    return demo.otherDatasets
      .filter((d) => datasourceIdsOf(d).includes(target.assetId))
      .map((d) => `dataset "${d.assetName}"`);
  }
  return [];
}

const scoped = (entry: CacheEntry): ScopedTarget => ({
  assetType: entry.assetType,
  assetId: entry.assetId,
  name: entry.assetName,
  entry,
});

export const demoCleanup: Playbook = {
  id: 'demo-cleanup',
  title: 'Remove the sample assets',
  description:
    'The sample analyses, datasets and data sources QuickSight creates in a new account. Each is archived before it is deleted (and can be restored); anything something else still reads is left for review.',
  category: 'cleanup',
  params: [],
  writes: ['analysis', 'dataset', 'datasource'],
  deletes: true,

  async scope() {
    const demo = await findDemoSet();
    return [...demo.analyses, ...demo.datasets, ...demo.datasources].map(scoped);
  },

  stage(target) {
    return STAGE[target.assetType] ?? 0;
  },

  async plan(_ctx, target) {
    const demo = await findDemoSet();
    const still = [...demo.analyses, ...demo.datasets, ...demo.datasources].some(
      (e) => e.assetType === target.assetType && e.assetId === target.assetId
    );
    if (!still) {
      return { verdict: 'skip', summary: 'Already gone, or no longer looks like a sample' };
    }
    const readers = readersOf(target, demo);
    if (readers.length > 0) {
      return {
        verdict: 'review',
        summary: `Still read by ${readers.slice(0, READERS_NAMED).join(', ')}${readers.length > READERS_NAMED ? ` and ${readers.length - READERS_NAMED} more` : ''}`,
      };
    }
    return {
      verdict: 'change',
      summary: 'Archive, then delete',
      changes: [`Delete ${target.name}`],
    };
  },

  async apply(ctx, target) {
    await ctx.call(
      'DELETE',
      `/api/assets/${target.assetType}/${encodeURIComponent(target.assetId)}?reason=${encodeURIComponent(REASON)}`
    );
    return { summary: 'Archived and deleted' };
  },
};
