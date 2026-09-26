import { Chip, Tooltip } from '@mui/material';

import type { SettingSource } from '@/shared/api/modules/settings';
import { pal } from '@/shared/design-system';

const LABEL: Record<SettingSource, string> = {
  stored: 'Stored',
  env: 'From environment',
  default: 'Default',
};

const HINT: Record<SettingSource, string> = {
  stored: 'Saved in the portal database. Overrides the environment.',
  env: 'Read from the Lambda environment. Save a value here to override it.',
  default: 'Nothing stored and nothing in the environment; the built-in default applies.',
};

/** Where a setting's effective value comes from. */
export function SourceBadge({ source, pending }: { source: SettingSource; pending?: boolean }) {
  return (
    <Tooltip title={pending ? 'Changed, not saved yet' : HINT[source]} arrow>
      <Chip
        size="small"
        label={pending ? 'Unsaved' : LABEL[source]}
        variant={source === 'stored' || pending ? 'filled' : 'outlined'}
        sx={(theme) => ({
          fontWeight: 700,
          ...(pending
            ? {
                backgroundColor: pal(theme).tone.warning.bg,
                color: pal(theme).tone.warning.text,
                border: `1px solid ${pal(theme).tone.warning.border}`,
              }
            : source === 'stored'
              ? { backgroundColor: pal(theme).brand.subtle, color: pal(theme).brand.primary }
              : { color: pal(theme).text.secondary }),
        })}
      />
    </Tooltip>
  );
}
