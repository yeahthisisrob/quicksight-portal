/**
 * SmusGate - renders its children only once SMUS has a domain and at least
 * one selected project. Author and the catalog are built on SMUS projects;
 * without a selection there is nothing for them to show, so the page says
 * what to do instead. Decided from the settings snapshot alone.
 */
import { CloudOff, FolderOff } from '@mui/icons-material';
import { Alert, AlertTitle, Box, Button, CircularProgress, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import { EmptyState } from '@/shared/design-system';

import { smusReadiness } from '../model/smusReadiness';
import { useSettingsSnapshot } from '../model/useSmusProjects';

interface SmusGateProps {
  /** What the page does, for the empty state: "Author" or "The catalog". */
  subject: string;
  children: ReactNode;
}

function Frame({ children }: { children: ReactNode }) {
  return <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>{children}</Box>;
}

export function SmusGate({ subject, children }: SmusGateProps) {
  const settings = useSettingsSnapshot();

  if (settings.isPending) {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'center', py: 8 }}
      >
        <CircularProgress size={22} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Reading settings
        </Typography>
      </Box>
    );
  }
  if (settings.isError) {
    return (
      <Frame>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void settings.refetch()}>
              Retry
            </Button>
          }
        >
          <AlertTitle>Settings could not be read</AlertTitle>
          {getApiErrorMessage(settings.error, 'Unknown error')}
        </Alert>
      </Frame>
    );
  }

  const readiness = smusReadiness(settings.data);
  if (readiness === 'not-configured') {
    return (
      <Frame>
        <EmptyState
          icon={<CloudOff />}
          title="Connect SageMaker Unified Studio first"
          description={`${subject} works from the assets published in your SMUS domain. Set the domain id and region in Settings, then pick the projects to read from.`}
          action={
            <Button component={RouterLink} to="/settings" variant="contained">
              Open Settings
            </Button>
          }
        />
      </Frame>
    );
  }
  if (readiness === 'no-projects') {
    return (
      <Frame>
        <EmptyState
          icon={<FolderOff />}
          title="No projects selected"
          description={`${subject} shows only what the selected SMUS projects publish. Choose at least one project under "Projects to read from" in Settings.`}
          action={
            <Button component={RouterLink} to="/settings" variant="contained">
              Choose projects
            </Button>
          }
        />
      </Frame>
    );
  }
  return <>{children}</>;
}
