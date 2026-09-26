/**
 * Dashboards and analyses tagged as layout standards: the look, furniture
 * and controls a new asset can be built on. Tagged in Author (the star on
 * a source) or with the quicksight-portal:template tag anywhere.
 */
import { OpenInNew } from '@mui/icons-material';
import { Alert, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';

import { assetsApi, getApiErrorMessage } from '@/shared/api';
import { EmptyState } from '@/shared/design-system';
import { templateIncludeTagsParam } from '@/shared/lib/templateTag';

const PAGE_SIZE = 50;

type Standard = { id: string; name: string; type: 'dashboard' | 'analysis' };

async function listStandards(): Promise<Standard[]> {
  const params = { page: 1, pageSize: PAGE_SIZE, includeTags: templateIncludeTagsParam() };
  const [dashboards, analyses] = await Promise.all([
    assetsApi.getDashboardsPaginated(params),
    assetsApi.getAnalysesPaginated(params),
  ]);
  const pick = (items: any[] | undefined, type: Standard['type']) =>
    (items ?? []).map((i) => ({
      id: String(i.dashboardId ?? i.analysisId ?? i.id),
      name: String(i.name ?? i.id),
      type,
    }));
  return [...pick(dashboards.dashboards, 'dashboard'), ...pick(analyses.analyses, 'analysis')];
}

export function LayoutStandards() {
  const standards = useQuery({
    queryKey: ['data-catalog', 'templates', 'layouts'],
    queryFn: listStandards,
  });
  if (standards.isLoading) {
    return <Skeleton variant="rounded" height={72} />;
  }
  if (standards.isError) {
    return (
      <Alert severity="error">
        {getApiErrorMessage(standards.error, 'The layout standards could not be loaded')}
      </Alert>
    );
  }
  if ((standards.data?.length ?? 0) === 0) {
    return (
      <EmptyState
        compact
        title="No layout standards yet"
        description="Star a dashboard or analysis in Author to make it a standard: new assets can take its layout, text, controls and theme."
      />
    );
  }
  return (
    <Stack spacing={1}>
      {standards.data?.map((s) => (
        <Stack key={`${s.type}:${s.id}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            size="small"
            variant="outlined"
            label={s.type === 'dashboard' ? 'Dashboard' : 'Analysis'}
          />
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {s.name}
          </Typography>
          <Button
            size="small"
            component={RouterLink}
            to={`/author?type=${s.type}&id=${encodeURIComponent(s.id)}`}
            endIcon={<OpenInNew fontSize="small" />}
          >
            Open in Author
          </Button>
        </Stack>
      ))}
    </Stack>
  );
}
