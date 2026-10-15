/**
 * The strip of counts over the calculated fields table. Numbers only; the
 * view's own control narrows the list.
 */
import type { CalculatedFieldCatalog } from '@/shared/api/modules/data-catalog';
import { StatStrip } from '@/shared/design-system';

interface FieldCountsProps {
  counts: CalculatedFieldCatalog['counts'];
}

export function FieldCounts({ counts }: FieldCountsProps) {
  return (
    <StatStrip
      ariaLabel="Calculated field counts"
      items={[
        { label: 'Calculated fields', value: counts.fields, hint: 'One per distinct expression' },
        { label: 'Distinct names', value: counts.names },
        {
          label: 'Conflicts',
          value: counts.conflicts,
          hint: 'Names with more than one expression',
        },
        { label: 'Templated', value: counts.templated },
        { label: 'Unused', value: counts.unused, hint: 'Read by nothing' },
        { label: 'Datasets', value: counts.datasets },
      ]}
    />
  );
}
