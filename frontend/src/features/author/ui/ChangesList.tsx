/**
 * "Changes you can read": the server's plain-language change list, grouped
 * by kind. Shown in the mockup and again in the publish summary.
 */
import { Box, Chip, Stack, Typography } from '@mui/material';

import type { DefinitionChange } from '@/shared/api/modules/authoring';

import { groupChanges } from '../lib/ops';

const KIND_COLOR: Record<
  DefinitionChange['kind'],
  'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning'
> = {
  rebind: 'primary',
  rename: 'info',
  calculatedField: 'success',
  layout: 'secondary',
  visual: 'warning',
  sheet: 'default',
};

interface ChangesListProps {
  changes: DefinitionChange[];
  /** What to say when the list is empty. */
  emptyText?: string;
  /** Hide the leading count line. */
  hideCount?: boolean;
}

export function ChangesList({
  changes,
  emptyText = 'Nothing changes yet.',
  hideCount = false,
}: ChangesListProps) {
  const groups = groupChanges(changes);
  if (groups.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {emptyText}
      </Typography>
    );
  }
  return (
    <Stack spacing={1.5} data-testid="changes-list">
      {!hideCount && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {changes.length} change{changes.length === 1 ? '' : 's'}
        </Typography>
      )}
      {groups.map((group) => (
        <Box key={group.kind}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <Chip size="small" color={KIND_COLOR[group.kind]} label={group.label} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {group.items.length}
            </Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {group.items.map((change, i) => (
              <Typography
                key={`${change.kind}-${i}-${change.description}`}
                component="li"
                variant="body2"
                sx={{ py: 0.25 }}
              >
                {change.description}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
