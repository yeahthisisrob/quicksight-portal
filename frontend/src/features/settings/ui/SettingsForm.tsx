import { Settings as SettingsIcon } from '@mui/icons-material';
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { type ReactNode, useMemo } from 'react';

import { Container, EmptyState, pal } from '@/shared/design-system';

import { type UseSettingsFormOptions, useSettingsForm } from '../lib/useSettingsForm';
import { SchedulesStatus } from './SchedulesStatus';
import { SettingField } from './SettingField';

/** A section the page adds beside the catalog's groups (API keys, Athena access). */
interface SettingsPanel {
  id: string;
  label: string;
  node: ReactNode;
}

interface SettingsFormProps extends UseSettingsFormOptions {
  /** Which section is open; the first group when unknown. */
  section?: string;
  onSectionChange?: (section: string) => void;
  panels?: SettingsPanel[];
}

const NAV_WIDTH = 220;

/**
 * The settings page: a list of sections on the left (every group the
 * server describes, then the page's own panels), one section open on the
 * right, and a sticky save bar once something changed. The form is one
 * instance across sections, so unsaved changes in one survive a visit to
 * another, and each section shows how many it holds.
 */
export function SettingsForm({
  section,
  onSectionChange,
  panels = [],
  ...options
}: SettingsFormProps) {
  const { enqueueSnackbar } = useSnackbar();
  const form = useSettingsForm({
    ...options,
    onSaved: () => {
      enqueueSnackbar('Settings saved', { variant: 'success' });
      options.onSaved?.();
    },
  });
  const groups = form.snapshot?.groups ?? [];
  const sections = useMemo(
    () => [
      ...groups.map((g) => ({ id: g.id, label: g.title })),
      ...panels.map((p) => ({ id: p.id, label: p.label })),
    ],
    [groups, panels]
  );
  const open = sections.some((s) => s.id === section) ? section! : (sections[0]?.id ?? '');
  const changedByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const key of Object.keys(form.draft)) {
      const group = key.split('.')[0] ?? '';
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return counts;
  }, [form.draft]);
  /** A setting's value as it stands now: the unsaved change, else what the server resolved. */
  const valueOf = (key: string): unknown => {
    if (key in form.draft) return form.draft[key];
    return groups.flatMap((g) => g.settings).find((s) => s.key === key)?.value;
  };

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

  if (sections.length === 0) {
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

  const group = groups.find((g) => g.id === open);
  const panel = panels.find((p) => p.id === open);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        alignItems: 'flex-start',
        pb: form.isDirty ? 10 : 0,
      }}
    >
      <List
        component="nav"
        aria-label="Settings sections"
        dense
        sx={{
          width: { xs: '100%', md: NAV_WIDTH },
          flexShrink: 0,
          position: { md: 'sticky' },
          top: { md: 16 },
          display: { xs: 'flex', md: 'block' },
          flexWrap: 'wrap',
          gap: { xs: 0.5, md: 0 },
          p: 0,
        }}
      >
        {sections.map((s) => {
          const changed = changedByGroup.get(s.id) ?? 0;
          return (
            <ListItemButton
              key={s.id}
              selected={s.id === open}
              onClick={() => onSectionChange?.(s.id)}
              sx={{ borderRadius: 2, width: { xs: 'auto', md: '100%' } }}
            >
              <ListItemText
                primary={s.label}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: s.id === open ? 700 : 500 } },
                }}
              />
              {changed > 0 && (
                <Badge
                  badgeContent={changed}
                  color="primary"
                  sx={{ mr: 1 }}
                  aria-label={`${changed} unsaved`}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {group && (
          <Container header={group.title} description={group.description}>
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
            {group.id === 'schedules' && (
              <SchedulesStatus
                cadences={Object.fromEntries(group.settings.map((s) => [s.key, valueOf(s.key)]))}
              />
            )}
            {form.snapshot?.updatedAt && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Last saved {new Date(form.snapshot.updatedAt).toLocaleString()}
                {form.snapshot.updatedBy ? ` by ${form.snapshot.updatedBy}` : ''}
              </Typography>
            )}
          </Container>
        )}
        {panel?.node}
      </Box>

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
            <Stack sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>
                {form.changedCount} unsaved {form.changedCount === 1 ? 'change' : 'changes'}
              </Typography>
              {form.saveError && (
                <Typography variant="body2" sx={(theme) => ({ color: pal(theme).tone.error.text })}>
                  {form.saveError}
                </Typography>
              )}
            </Stack>
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
    </Box>
  );
}
