/**
 * Every data source in the account ranked by use: how many datasets read
 * through it, and how many of those are linked to a SMUS listing. This is
 * the list a new dataset chooses its data source from, and the ranking the
 * default Athena source for a listing is taken from, so "the most used
 * Athena data source" means one thing everywhere.
 */
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import type { SmusDatasetLink } from '../../types/smus';
import { catalog } from '../catalog/catalogStore';

export interface DataSourceUsage {
  id: string;
  name: string;
  arn: string;
  /** The engine, as QuickSight names it: ATHENA, REDSHIFT, ... */
  type?: string;
  /** Athena only: the workgroup its queries run in. */
  workGroup?: string;
  /** Datasets reading through it. */
  datasets: number;
  /** Of those, the ones linked to a SMUS listing. */
  governedDatasets: number;
}

/**
 * Ranked governed use first, then overall use, then name. `links` is the
 * SMUS link map, or empty when SMUS is not configured.
 */
export async function listDataSourceUsage(
  links: Map<string, SmusDatasetLink>
): Promise<DataSourceUsage[]> {
  const [dataSources, datasets] = await Promise.all([
    catalog.list(ASSET_TYPES.datasource, AssetStatusFilter.ACTIVE),
    catalog.list(ASSET_TYPES.dataset),
  ]);
  const overall = new Map<string, number>();
  const governed = new Map<string, number>();
  for (const dataset of datasets) {
    const ids: unknown[] = dataset.metadata?.lineageData?.datasourceIds ?? [];
    const isGoverned = links.get(dataset.assetId)?.linked === true;
    for (const id of new Set(ids.filter((v): v is string => typeof v === 'string'))) {
      overall.set(id, (overall.get(id) ?? 0) + 1);
      if (isGoverned) {
        governed.set(id, (governed.get(id) ?? 0) + 1);
      }
    }
  }
  return dataSources
    .filter((d) => Boolean(d.arn))
    .map((d) => {
      const type = d.metadata?.sourceType ?? d.metadata?.datasourceType;
      const workGroup = d.metadata?.workGroup;
      return {
        id: d.assetId,
        name: d.assetName,
        arn: d.arn,
        ...(typeof type === 'string' ? { type: type.toUpperCase() } : {}),
        ...(typeof workGroup === 'string' ? { workGroup } : {}),
        datasets: overall.get(d.assetId) ?? 0,
        governedDatasets: governed.get(d.assetId) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.governedDatasets - a.governedDatasets ||
        b.datasets - a.datasets ||
        a.name.localeCompare(b.name)
    );
}

export function isAthena(dataSource: Pick<DataSourceUsage, 'type'>): boolean {
  return dataSource.type === 'ATHENA';
}

/**
 * The Athena data source a dataset over a SMUS listing reads through, with
 * why. SMUS tables are Glue tables read by Athena, and the datasets already
 * linked to listings show which Athena source the account uses for them.
 * With none of those, the Athena source most datasets use; with none, the
 * only one; with no Athena source at all, null.
 */
export function defaultAthenaDataSource(
  usage: DataSourceUsage[]
): { dataSource: DataSourceUsage; reason: string } | null {
  const athena = usage.filter(isAthena);
  const best = athena[0];
  if (!best) {
    return null;
  }
  const reason =
    best.governedDatasets > 0
      ? `used by ${best.governedDatasets} dataset${best.governedDatasets === 1 ? '' : 's'} linked to SMUS listings`
      : best.datasets > 0
        ? `the Athena data source most datasets read through (${best.datasets}); no SMUS-linked dataset reads one yet`
        : athena.length === 1
          ? 'the only Athena data source in the account'
          : `the first of ${athena.length} Athena data sources by name; no dataset reads through any of them yet`;
  return { dataSource: best, reason };
}
