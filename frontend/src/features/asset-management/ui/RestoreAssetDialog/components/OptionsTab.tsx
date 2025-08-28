/**
 * Options tab component for RestoreAssetDialog
 */
import { Checkbox, FormControlLabel, Stack } from '@mui/material';

import type { RestoreOptions } from '../types';

interface OptionsTabProps {
  options: RestoreOptions;
  onChange: (updates: Partial<RestoreOptions>) => void;
}

export function OptionsTab({ options, onChange }: OptionsTabProps) {
  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Checkbox
            checked={options.skipIfExists}
            onChange={(e) => {
              onChange({ 
                skipIfExists: e.target.checked,
                overwriteExisting: e.target.checked ? false : options.overwriteExisting
              });
            }}
          />
        }
        label="Skip if asset already exists"
      />
      
      <FormControlLabel
        control={
          <Checkbox
            checked={options.overwriteExisting}
            onChange={(e) => {
              onChange({ 
                overwriteExisting: e.target.checked,
                skipIfExists: e.target.checked ? false : options.skipIfExists
              });
            }}
          />
        }
        label="Overwrite if asset already exists"
      />
      
      <FormControlLabel
        control={
          <Checkbox
            checked={options.createBackup}
            onChange={(e) => onChange({ createBackup: e.target.checked })}
          />
        }
        label="Create backup of archived version"
      />
      
      <FormControlLabel
        control={
          <Checkbox
            checked={options.dryRun}
            onChange={(e) => onChange({ dryRun: e.target.checked })}
          />
        }
        label="Dry run (validate only, don't restore)"
      />
    </Stack>
  );
}