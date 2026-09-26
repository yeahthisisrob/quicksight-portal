/**
 * QuickSight CloudWatch health for the rows on screen: one batched read per
 * page of dashboards or datasets, shared with every cell through context so
 * columns stay plain config.
 */
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { type AssetHealth, activityApi } from '@/shared/api/modules/activity';

type HealthAssetType = 'dashboard' | 'dataset';

interface AssetHealthState {
  /** Undefined until loaded; false when CloudWatch has nothing for this account. */
  available?: boolean;
  windowDays: number;
  byId: Map<string, AssetHealth>;
}

const EMPTY: AssetHealthState = { windowDays: 30, byId: new Map() };
const AssetHealthContext = createContext<AssetHealthState>(EMPTY);

function supportsHealth(assetType: string): assetType is HealthAssetType {
  return assetType === 'dashboard' || assetType === 'dataset';
}

export function AssetHealthProvider({
  assetType,
  assets,
  children,
}: {
  assetType: string;
  assets: Array<{ id: string }>;
  children: ReactNode;
}) {
  const ids = useMemo(
    () =>
      assets
        .map((a) => a.id)
        .filter(Boolean)
        .sort(),
    [assets]
  );
  const enabled = supportsHealth(assetType) && ids.length > 0;
  const query = useQuery({
    queryKey: ['asset-health', assetType, ids],
    queryFn: () => activityApi.getAssetHealth(assetType as HealthAssetType, ids),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const value = useMemo<AssetHealthState>(() => {
    if (!query.data) {
      return { ...EMPTY, available: query.error ? false : undefined };
    }
    return {
      available: query.data.available,
      windowDays: query.data.windowDays,
      byId: new Map(query.data.items.map((h) => [h.id, h])),
    };
  }, [query.data, query.error]);
  return <AssetHealthContext.Provider value={value}>{children}</AssetHealthContext.Provider>;
}

export function useAssetHealth(): AssetHealthState {
  return useContext(AssetHealthContext);
}
