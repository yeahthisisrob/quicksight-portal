/**
 * Theme - what the open dashboard or analysis wears, and another to put on
 * it. Applying writes only the theme (the definition goes through the same
 * dry-run as a rebind), straight to QuickSight, separate from the edits a
 * save writes. Across many assets at once, the "Apply the standard theme"
 * and "Move to a new theme" playbooks do the same.
 */
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { ThemePicker, themeIdOf, useThemes } from '@/entities/theme';

import { authoringApi } from '@/shared/api';
import { announceAssetChanges } from '@/shared/lib/assetChanges';
import { ColorSwatches } from '@/shared/ui';

import type { Studio } from '../../model/useStudio';

export function ThemePanel({ studio }: { studio: Studio }) {
  const source = studio.state.source!;
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { options } = useThemes();
  const currentId = themeIdOf(studio.source.themeArn);
  const current = options.find((o) => o.id.toLowerCase() === currentId?.toLowerCase());
  const [chosen, setChosen] = useState('');

  const apply = useMutation({
    mutationFn: (theme: string) =>
      authoringApi.applyRebind(source.type, source.id, { mode: 'update', rebinds: [], theme }),
    onSuccess: (_, theme) => {
      enqueueSnackbar(`${source.name} now wears ${theme}`, { variant: 'success' });
      setChosen('');
      void queryClient.invalidateQueries({ queryKey: ['asset-json', source.type, source.id] });
      announceAssetChanges([source.type, 'theme']);
    },
  });

  return (
    <Stack spacing={2} data-testid="theme-panel">
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
          Wears
        </Typography>
        {currentId ? (
          <Stack spacing={0.75}>
            <Typography variant="body2">{current?.name ?? currentId}</Typography>
            {current && current.dataColors.length > 0 && (
              <ColorSwatches colors={current.dataColors} />
            )}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            QuickSight’s default theme
          </Typography>
        )}
      </Box>
      {studio.archived ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Restore it first to change its theme.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <ThemePicker label="Change to" value={chosen} onChange={setChosen} width={320} />
          {studio.dirty && (
            <Alert severity="info">
              The theme is written on its own, now; your unsaved edits stay here to save.
            </Alert>
          )}
          {apply.isError && <Alert severity="error">{apply.error.message}</Alert>}
          <Box>
            <Button
              variant="contained"
              disabled={!chosen || chosen === currentId || apply.isPending}
              onClick={() => apply.mutate(chosen)}
            >
              {apply.isPending ? 'Applying…' : 'Apply theme'}
            </Button>
          </Box>
        </Stack>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Many at once: the <RouterLink to="/author?tab=studio&view=playbooks">playbooks</RouterLink>{' '}
        apply a standard theme, or move everything off one theme onto another. New themes, including
        ones drawn from a picture of your brand, are made under{' '}
        <RouterLink to="/assets/themes">Themes</RouterLink>.
      </Typography>
    </Stack>
  );
}
