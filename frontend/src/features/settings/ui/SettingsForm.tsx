import { Settings as SettingsIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';

import { Container, EmptyState, pal } from '@/shared/design-system';

import { type UseSettingsFormOptions, useSettingsForm } from '../lib/useSettingsForm';
import { SettingField } from './SettingField';

/**
 * Every settings group the server describes, rendered generically, with a
 * sticky save bar that appears once something changed.
 */
export function SettingsForm(options: UseSettingsFormOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const form = useSettingsForm({
    ...options,
    onSaved: () => {
      enqueueSnackbar('Settings saved', { variant: 'success' });
      options.onSaved?.();
    },
  });

  if (form.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (form.loadError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => form.reload()}>
            Retry
          </Button>
        }
      >
        {form.loadError}
      </Alert>
    );
  }

  const groups = form.snapshot?.groups ?? [];
  if (groups.length === 0) {
    return (
      <Container>
        <EmptyState
          icon={<SettingsIcon />}
          title="No settings to show"
          description="The server did not describe any configurable settings for this deployment."
        />
      </Container>
    );
  }

  return (
    <Stack spacing={2} sx={{ pb: form.isDirty ? 10 : 0 }}>
      {groups.map((group) => (
        <Container key={group.id} header={group.title} description={group.description}>
          {group.settings.map((definition) => (
            <SettingField
              key={definition.key}
              definition={definition}
              draft={form.draft}
              disabled={form.isSaving}
              onSet={(value) => form.dispatch({ type: 'set', key: definition.key, value })}
              onReset={() => form.dispatch({ type: 'reset', key: definition.key })}
              onRevert={() => form.dispatch({ type: 'revert', key: definition.key })}
            />
          ))}
        </Container>
      ))}

      {form.snapshot?.updatedAt && (
        <Typography variant="body2" color="text.secondary">
          Last saved {new Date(form.snapshot.updatedAt).toLocaleString()}
          {form.snapshot.updatedBy ? ` by ${form.snapshot.updatedBy}` : ''}
        </Typography>
      )}

      {form.isDirty && (
        <Box
          role="region"
          aria-label="Unsaved changes"
          sx={(theme) => ({
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: theme.zIndex.appBar,
            display: 'flex',
            justifyContent: 'center',
            p: 2,
            pointerEvents: 'none',
          })}
        >
          <Box
            sx={(theme) => ({
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2.5,
              py: 1.5,
              borderRadius: 3,
              backgroundColor: pal(theme).surface.inverse,
              color: pal(theme).text.inverse,
              boxShadow: theme.shadows[8],
              minWidth: 360,
            })}
          >
            <Typography sx={{ fontWeight: 700, flex: 1 }}>
              {form.changedCount} unsaved {form.changedCount === 1 ? 'change' : 'changes'}
            </Typography>
            {form.saveError && (
              <Typography variant="body2" sx={(theme) => ({ color: pal(theme).tone.error.text })}>
                {form.saveError}
              </Typography>
            )}
            <Button
              variant="text"
              color="inherit"
              onClick={() => {
                form.dispatch({ type: 'discard' });
                form.clearSaveError();
              }}
              disabled={form.isSaving}
            >
              Discard
            </Button>
            <Button
              variant="contained"
              onClick={() => form.save()}
              disabled={form.isSaving}
              startIcon={form.isSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Save
            </Button>
          </Box>
        </Box>
      )}
    </Stack>
  );
}

export default SettingsForm;
