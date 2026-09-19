/**
 * What the portal knows about how the source is used: views, viewers, when
 * it was last opened and, for dashboards with CloudWatch metrics, how fast
 * it loads and which visuals are struggling.
 */
import { Alert, Box, Chip, Skeleton, Stack, Typography } from '@mui/material';

import type { AssetInsights } from '@/shared/api/modules/authoring';

import { isSlow, problemVisuals, seconds } from '../lib/insights';
import { compactNumber, timeAgo } from '../lib/ranking';
import type { SourceInsights } from '../model/useAuthorFlow';
import { KeyValueList } from './primitives/KeyValue';
import { StatusIndicator } from './primitives/StatusIndicator';

function HealthLine({ insights }: { insights: AssetInsights }) {
  const health = insights.health;
  if (!health) {
    return null;
  }
  const problems = problemVisuals(insights);
  const slow = problems.filter(isSlow).length;
  const failing = problems.length - slow;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      {problems.length === 0 ? (
        <StatusIndicator kind="success">Every visual loads cleanly</StatusIndicator>
      ) : (
        <StatusIndicator kind="warning">
          {problems.length} visual{problems.length === 1 ? '' : 's'} worth a look
        </StatusIndicator>
      )}
      {slow > 0 && <Chip size="small" color="warning" variant="outlined" label={`${slow} slow`} />}
      {failing > 0 && (
        <Chip size="small" color="error" variant="outlined" label={`${failing} with errors`} />
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {health.viewLoads} loads over {health.windowDays} days
      </Typography>
    </Stack>
  );
}

export function InsightsCard({ insights }: { insights: SourceInsights }) {
  if (insights.loading) {
    return (
      <Box data-testid="insights-card">
        <Skeleton variant="rounded" height={64} />
      </Box>
    );
  }
  if (insights.error) {
    return <Alert severity="info">{insights.error}</Alert>;
  }
  const data = insights.data;
  if (!data) {
    return null;
  }
  const last = timeAgo(data.views.lastViewedAt);
  const items = [
    {
      label: 'Views (30 days / all time)',
      value: `${compactNumber(data.views.last30d)} / ${compactNumber(data.views.total)}`,
    },
    { label: 'Viewers', value: compactNumber(data.views.uniqueViewers) },
    { label: 'Last viewed', value: last ?? 'Never' },
    ...(data.health?.viewLoadTimeP90Ms !== undefined
      ? [{ label: 'View load time (p90)', value: seconds(data.health.viewLoadTimeP90Ms) }]
      : []),
  ];
  return (
    <Stack spacing={1.5} data-testid="insights-card">
      <KeyValueList items={items} columns={4} />
      <HealthLine insights={data} />
    </Stack>
  );
}
