/**
 * SmusGate - renders its children only once SMUS has at least one reachable
 * project. Author and the catalog are built on SMUS projects; without one
 * there is nothing for them to show, so the page says what to fix instead.
 */
import { CloudOff, FolderOff } from '@mui/icons-material';
import { Alert, AlertTitle, Box, Button, CircularProgress, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import { EmptyState } from '@/shared/design-system';

import { describeProjectDiagnostics, smusReadiness } from '../model/smusReadiness';
import { useSmusProjects } from '../model/useSmusProjects';

interface SmusGateProps {
  /** What the page does, for the empty state: "Author" or "The catalog". */
  subject: string;
  children: ReactNode;
}

function Frame({ children }: { children: ReactNode }) {
  return <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>{children}</Box>;
}

export function SmusGate({ subject, children }: SmusGateProps) {
  const projects = useSmusProjects();

  if (projects.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (projects.isError) {
    return (
      <Frame>
        <Alert severity="error">
          <AlertTitle>Could not reach SageMaker Unified Studio</AlertTitle>
          {getApiErrorMessage(projects.error, 'Unknown error')}
        </Alert>
      </Frame>
    );
  }
  if (!projects.data) {
    return null;
  }

  const readiness = smusReadiness(projects.data);
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
    const detail = describeProjectDiagnostics(projects.data.diagnostics);
    return (
      <Frame>
        <EmptyState
          icon={<FolderOff />}
          title="No active SMUS projects"
          description={
            <>
              {subject} has nothing to show until the portal can see at least one project in the
              domain.
              {detail && (
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}
                >
                  {detail}
                </Typography>
              )}
            </>
          }
          action={
            <Button component={RouterLink} to="/settings" variant="contained">
              Review project access
            </Button>
          }
        />
      </Frame>
    );
  }
  return <>{children}</>;
}
