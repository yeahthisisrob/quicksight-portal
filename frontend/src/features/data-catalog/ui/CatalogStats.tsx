import { StatStrip } from '@/shared/design-system';

import type { CatalogCounts } from '../model/catalogState';

interface CatalogStatsProps {
  counts: CatalogCounts;
}

/** A compact strip of counts for the project in view. */
export function CatalogStats({ counts }: CatalogStatsProps) {
  return (
    <StatStrip
      ariaLabel="Catalog counts"
      items={[
        { label: 'Published assets', value: counts.assets },
        { label: 'With a QuickSight dataset', value: counts.withDataset },
        { label: 'Without one', value: counts.withoutDataset },
        { label: 'Calculated fields', value: counts.calculatedFields },
        { label: 'Glossary terms', value: counts.terms },
      ]}
    />
  );
}
