/**
 * Composition root for the ports: the slices that read activity, rebuild the
 * data catalog index or re-export assets reach each other through ports in
 * shared/, and both Lambdas (index.ts, worker.ts) fill them here, once.
 */
import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';

import { CloudTrailAdapter } from './adapters/aws/CloudTrailAdapter';
import { ActivityService } from './features/activity/services/ActivityService';
import { CatalogService } from './features/data-catalog/services/CatalogService';
import { ExportOrchestrator } from './features/data-export/services/ExportOrchestrator';
import { registerActivityReader } from './shared/services/activity/activityReader';
import { cacheService } from './shared/services/cache/CacheService';
import { registerAssetRefresher } from './shared/services/catalog/assetRefresher';
import { registerCatalogIndexer } from './shared/services/catalog/catalogIndexer';
import { GroupService } from './shared/services/organization/GroupService';

export function wirePorts(): void {
  // The export rebuilds the data catalog index; the catalog slice does the work.
  registerCatalogIndexer({
    clear: () => new CatalogService().clearCatalog(),
    rebuild: async () => {
      const catalog = new CatalogService();
      await catalog.rebuildCatalogIndex();
      await catalog.buildVisualFieldCatalog();
    },
  });
  // Slices read activity through a port; the activity slice's service is the reader.
  registerActivityReader(() => {
    const region = process.env.AWS_REGION || 'us-east-1';
    return new ActivityService(
      cacheService,
      new CloudTrailAdapter(new CloudTrailClient({ region }), region),
      new GroupService()
    );
  });
  // Deletes archive what QuickSight has now, and bulk changes re-read what
  // they touched: both through the export's own refresh.
  registerAssetRefresher((assets) =>
    new ExportOrchestrator(process.env.AWS_ACCOUNT_ID || '').refreshAssets(assets)
  );
}
