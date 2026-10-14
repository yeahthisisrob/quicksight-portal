/**
 * SPICE or direct query, as one switch. Changing it changes nothing else
 * about the dataset; a switch to SPICE starts the first import on save.
 */
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

export type ImportMode = 'SPICE' | 'DIRECT_QUERY';

export function ImportModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (mode: ImportMode) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      disabled={disabled}
      onChange={(_, mode: ImportMode | null) => {
        if (mode) onChange(mode);
      }}
      aria-label="Import mode"
    >
      <ToggleButton value="SPICE">
        <Tooltip title="Imported into SPICE and refreshed on a schedule: fast, and the source is read only at refresh time.">
          <span>SPICE</span>
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="DIRECT_QUERY">
        <Tooltip title="The query runs against the source on every view: always current, as fast as the source.">
          <span>Direct query</span>
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
