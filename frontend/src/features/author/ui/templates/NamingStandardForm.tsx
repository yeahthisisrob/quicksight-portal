/**
 * The calculated-field naming standard: the prefix for fields an analysis or
 * dashboard defines, and the one for fields a dataset defines. Saved to
 * Settings, so the Assistant and the planner name new fields the same way,
 * and the fields that do not follow it can be found and renamed.
 */
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';

import {
  DEFAULT_NAMING,
  type NamingStandard,
  PREFIX_PATTERN,
  standardName,
  useNamingStandard,
} from '@/entities/template';

import { getApiErrorMessage } from '@/shared/api';

const EXAMPLE = 'Net Margin';

export function NamingStandardForm() {
  const { standard, loading, save } = useNamingStandard();
  const { enqueueSnackbar } = useSnackbar();
  const [draft, setDraft] = useState<NamingStandard>(standard);

  // The snapshot arrives after the first render, and a save changes it.
  const { calcFieldPrefix, datasetCalcFieldPrefix } = standard;
  useEffect(() => {
    setDraft({ calcFieldPrefix, datasetCalcFieldPrefix });
  }, [calcFieldPrefix, datasetCalcFieldPrefix]);

  const invalid = (value: string) => !PREFIX_PATTERN.test(value);
  const changed =
    draft.calcFieldPrefix !== standard.calcFieldPrefix ||
    draft.datasetCalcFieldPrefix !== standard.datasetCalcFieldPrefix;
  const valid = !invalid(draft.calcFieldPrefix) && !invalid(draft.datasetCalcFieldPrefix);
  const same = draft.calcFieldPrefix === draft.datasetCalcFieldPrefix;

  const field = (name: keyof NamingStandard, label: string, home: 'exploration' | 'dataset') => (
    <TextField
      size="small"
      label={label}
      value={draft[name]}
      disabled={loading || save.isPending}
      onChange={(e) => setDraft((prev) => ({ ...prev, [name]: e.target.value.trim() }))}
      error={invalid(draft[name])}
      helperText={
        invalid(draft[name])
          ? 'Letters, digits and underscores, starting with a letter'
          : `"${EXAMPLE}" becomes ${standardName(EXAMPLE, home, draft)}`
      }
      sx={{ flex: 1, minWidth: 220 }}
      slotProps={{ htmlInput: { 'aria-label': label, spellCheck: false } }}
    />
  );

  return (
    <Stack spacing={1.5} data-testid="naming-standard">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {field('calcFieldPrefix', 'Analyses and dashboards', 'exploration')}
        {field('datasetCalcFieldPrefix', 'Datasets', 'dataset')}
      </Stack>
      {same && valid && (
        <Alert severity="warning">
          With one prefix for both, a name no longer says whether the field lives in the dataset or
          the analysis.
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
          The default is {DEFAULT_NAMING.calcFieldPrefix} in analyses and dashboards and{' '}
          {DEFAULT_NAMING.datasetCalcFieldPrefix} in datasets. Existing fields are not renamed here.
        </Typography>
        <Button size="small" disabled={!changed} onClick={() => setDraft(standard)}>
          Discard
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!changed || !valid || save.isPending}
          onClick={() =>
            save.mutate(draft, {
              onSuccess: () => enqueueSnackbar('Naming standard saved', { variant: 'success' }),
              onError: (error) =>
                enqueueSnackbar(getApiErrorMessage(error, 'The standard was not saved'), {
                  variant: 'error',
                }),
            })
          }
        >
          Save
        </Button>
      </Stack>
    </Stack>
  );
}
