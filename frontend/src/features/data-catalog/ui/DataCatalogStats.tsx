/**
 * Data Catalog Stats Component
 * Displays statistics based on the selected view mode
 */
import { CalculatedStatsView } from './stats-views/CalculatedStatsView';
import { PhysicalStatsView } from './stats-views/PhysicalStatsView';
import { SemanticStatsView } from './stats-views/SemanticStatsView';
import { VisualFieldStatsView } from './stats-views/VisualFieldStatsView';

import type { DataCatalogStatsProps } from '../model/types';

export default function DataCatalogStats({
  viewMode,
  stats,
  catalogSummary,
  visualFieldSummary,
}: DataCatalogStatsProps) {
  // Render appropriate view based on viewMode
  switch (viewMode) {
    case 'physical':
      return catalogSummary ? <PhysicalStatsView catalogSummary={catalogSummary} /> : null;
    
    case 'semantic':
      return stats ? <SemanticStatsView stats={stats} /> : null;
    
    case 'visual-fields':
      return visualFieldSummary ? <VisualFieldStatsView visualFieldSummary={visualFieldSummary} /> : null;
    
    case 'calculated':
      return catalogSummary ? <CalculatedStatsView catalogSummary={catalogSummary} /> : null;
    
    default:
      return null;
  }
}