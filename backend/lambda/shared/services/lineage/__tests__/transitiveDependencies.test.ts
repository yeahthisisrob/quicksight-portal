import { describe, expect, it } from 'vitest';

import { LineageService, type AssetLineage, type LineageRelationship } from '../LineageService';

function entry(assetId: string, assetType: string, assetName: string): AssetLineage {
  return {
    assetId,
    assetType,
    assetName,
    isArchived: false,
    relationships: [],
  } as unknown as AssetLineage;
}

function link(
  map: Map<string, AssetLineage>,
  sourceId: string,
  targetId: string,
  relationshipType: 'uses' | 'used_by'
): void {
  const source = map.get(sourceId)!;
  const target = map.get(targetId)!;
  source.relationships.push({
    sourceAssetId: source.assetId,
    sourceAssetType: source.assetType,
    sourceAssetName: source.assetName,
    sourceIsArchived: false,
    targetAssetId: target.assetId,
    targetAssetType: target.assetType,
    targetAssetName: target.assetName,
    targetIsArchived: false,
    relationshipType,
  } as LineageRelationship);
}

function rels(map: Map<string, AssetLineage>, id: string): Array<[string, string, string]> {
  return map
    .get(id)!
    .relationships.map(
      (r) => [r.relationshipType, r.targetAssetType, r.targetAssetId] as [string, string, string]
    );
}

// buildTransitiveDependencies is private; it is pure over the lineage map, so
// exercise it directly via the prototype
function runTransitive(map: Map<string, AssetLineage>): void {
  (LineageService.prototype as any).buildTransitiveDependencies.call(
    Object.create(LineageService.prototype),
    map
  );
}

describe('LineageService.buildTransitiveDependencies (composite chains)', () => {
  it('connects dashboards to source datasets and datasources through a composite dataset', () => {
    const map = new Map<string, AssetLineage>();
    map.set('dash-1', entry('dash-1', 'dashboard', 'Dashboard'));
    map.set('composite', entry('composite', 'dataset', 'Composite'));
    map.set('source-a', entry('source-a', 'dataset', 'Source A'));
    map.set('source-b', entry('source-b', 'dataset', 'Source B'));
    map.set('ds-1', entry('ds-1', 'datasource', 'Athena DS'));

    // Direct edges as processAssetRelationships would create them
    link(map, 'dash-1', 'composite', 'uses');
    link(map, 'composite', 'dash-1', 'used_by');
    link(map, 'composite', 'source-a', 'uses');
    link(map, 'source-a', 'composite', 'used_by');
    link(map, 'composite', 'source-b', 'uses');
    link(map, 'source-b', 'composite', 'used_by');
    link(map, 'source-a', 'ds-1', 'uses');
    link(map, 'ds-1', 'source-a', 'used_by');

    runTransitive(map);

    // Dashboard reaches the source datasets and the datasource behind them
    expect(rels(map, 'dash-1')).toEqual(
      expect.arrayContaining([
        ['uses', 'dataset', 'source-a'],
        ['uses', 'dataset', 'source-b'],
        ['uses', 'datasource', 'ds-1'],
      ])
    );

    // Source datasets learn they are (transitively) used by the dashboard —
    // this is what feeds dataset activity for composite sources
    expect(rels(map, 'source-a')).toEqual(
      expect.arrayContaining([['used_by', 'dashboard', 'dash-1']])
    );
    expect(rels(map, 'source-b')).toEqual(
      expect.arrayContaining([['used_by', 'dashboard', 'dash-1']])
    );

    // The datasource learns about the dashboard two hops up
    expect(rels(map, 'ds-1')).toEqual(expect.arrayContaining([['used_by', 'dashboard', 'dash-1']]));
  });

  it('does not loop on dataset cycles', () => {
    const map = new Map<string, AssetLineage>();
    map.set('dash-1', entry('dash-1', 'dashboard', 'Dashboard'));
    map.set('c1', entry('c1', 'dataset', 'C1'));
    map.set('c2', entry('c2', 'dataset', 'C2'));

    link(map, 'dash-1', 'c1', 'uses');
    link(map, 'c1', 'c2', 'uses');
    link(map, 'c2', 'c1', 'uses'); // pathological cycle

    runTransitive(map);

    expect(rels(map, 'dash-1')).toEqual(
      expect.arrayContaining([
        ['uses', 'dataset', 'c1'],
        ['uses', 'dataset', 'c2'],
      ])
    );
    // No duplicates from the cycle
    const c2Uses = rels(map, 'dash-1').filter(([, , id]) => id === 'c2');
    expect(c2Uses).toHaveLength(1);
  });

  it('keeps plain single-hop behavior intact (no composite)', () => {
    const map = new Map<string, AssetLineage>();
    map.set('an-1', entry('an-1', 'analysis', 'Analysis'));
    map.set('data-1', entry('data-1', 'dataset', 'Dataset'));
    map.set('ds-1', entry('ds-1', 'datasource', 'DS'));

    link(map, 'an-1', 'data-1', 'uses');
    link(map, 'data-1', 'an-1', 'used_by');
    link(map, 'data-1', 'ds-1', 'uses');
    link(map, 'ds-1', 'data-1', 'used_by');

    runTransitive(map);

    expect(rels(map, 'an-1')).toEqual(expect.arrayContaining([['uses', 'datasource', 'ds-1']]));
    expect(rels(map, 'ds-1')).toEqual(expect.arrayContaining([['used_by', 'analysis', 'an-1']]));
  });
});
