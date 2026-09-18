import {
  Autocomplete,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import type {
  ColumnResolution,
  ColumnUsage,
  DatasetRebindPlan,
} from '@/shared/api/modules/authoring';

interface ColumnResolutionTableProps {
  plan: DatasetRebindPlan;
  columnMap: Record<string, string>;
  onMap: (sourceColumn: string, targetColumn: string | null) => void;
  disabled?: boolean;
}

const STATUS_CHIP: Record<
  ColumnResolution['status'],
  { label: string; color: 'success' | 'info' | 'warning' | 'error' }
> = {
  matched: { label: 'Matched', color: 'success' },
  mapped: { label: 'Renamed', color: 'info' },
  suggested: { label: 'Needs a decision', color: 'warning' },
  missing: { label: 'Missing', color: 'error' },
};

const USAGE_LABELS: Array<[keyof ColumnUsage, string]> = [
  ['visual', 'visual'],
  ['filter', 'filter'],
  ['calculatedField', 'calc field'],
  ['parameter', 'parameter'],
  ['control', 'control'],
  ['other', 'other'],
];

function describeUsage(usage: ColumnUsage): string {
  return USAGE_LABELS.filter(([key]) => usage[key] > 0)
    .map(([key, label]) => `${usage[key]} ${label}${usage[key] === 1 ? '' : 's'}`)
    .join(', ');
}

/**
 * One row per column the definition reads from this dataset. Matched rows
 * need nothing. Suggested and missing rows get a picker over the target's
 * still-unused columns; a suggestion is pre-offered but never applied until
 * chosen, so every rename is a decision someone made.
 */
export function ColumnResolutionTable({
  plan,
  columnMap,
  onMap,
  disabled,
}: ColumnResolutionTableProps) {
  const choices = (column: ColumnResolution): string[] => {
    const pool = new Set<string>(plan.unusedTargetColumns);
    if (column.suggestion) {
      pool.add(column.suggestion);
    }
    if (column.resolvedTo) {
      pool.add(column.resolvedTo);
    }
    return [...pool].sort((a, b) => a.localeCompare(b));
  };

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Column</TableCell>
          <TableCell>Used by</TableCell>
          <TableCell>Status</TableCell>
          <TableCell sx={{ width: 260 }}>In the new dataset</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {plan.columns.map((column) => {
          const chip = STATUS_CHIP[column.status];
          const decided = column.status === 'matched';
          return (
            <TableRow key={column.name} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {column.name}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {describeUsage(column.usage) || 'unused'}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip size="small" label={chip.label} color={chip.color} variant="outlined" />
              </TableCell>
              <TableCell>
                {decided ? (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {column.resolvedTo}
                  </Typography>
                ) : (
                  <Autocomplete
                    options={choices(column)}
                    value={columnMap[column.name] ?? null}
                    onChange={(_, next) => onMap(column.name, next)}
                    disabled={disabled}
                    size="small"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={
                          column.suggestion ? `Suggested: ${column.suggestion}` : 'Pick a column'
                        }
                        error={column.status === 'missing' && !column.suggestion}
                      />
                    )}
                  />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
