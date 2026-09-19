/**
 * Health cells for dashboards (load time, errors) and datasets (refresh
 * latency, error rows), from QuickSight's CloudWatch metrics over 30 days.
 */
import { Tooltip, Typography } from '@mui/material';

import { StatusIndicator } from '@/shared/design-system';

import { useAssetHealth } from '../../model/assetHealth';

const SLOW_MS = 5000;
const OK_MS = 2000;
const MS_PER_SECOND = 1000;

function seconds(ms: number): string {
  return ms >= MS_PER_SECOND ? `${(ms / MS_PER_SECOND).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function Muted({ text }: { text: string }) {
  return (
    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
      {text}
    </Typography>
  );
}

/** p90 load time (dashboards) or p90 ingestion latency (datasets). */
export function LoadTimeCell({ id }: { id: string }) {
  const health = useAssetHealth();
  const row = health.byId.get(id);
  const ms = row?.viewLoadTimeP90Ms ?? row?.ingestionLatencyP90Ms;
  if (health.available === false) {
    return <Muted text="no metrics" />;
  }
  if (ms === undefined) {
    return <Muted text={health.available === undefined ? '…' : '—'} />;
  }
  const kind = ms >= SLOW_MS ? 'error' : ms >= OK_MS ? 'warning' : 'success';
  return (
    <Tooltip title={`p90 over the last ${health.windowDays} days, from CloudWatch`}>
      <span>
        <StatusIndicator type={kind} size="small">
          {seconds(ms)}
        </StatusIndicator>
      </span>
    </Tooltip>
  );
}

/** Visual load errors (dashboards) or ingestion error rows (datasets). */
export function ErrorsCell({ id }: { id: string }) {
  const health = useAssetHealth();
  const row = health.byId.get(id);
  const count = row?.visualErrors ?? row?.ingestionErrorRows;
  if (health.available === false) {
    return <Muted text="no metrics" />;
  }
  if (count === undefined) {
    return <Muted text={health.available === undefined ? '…' : '—'} />;
  }
  if (count === 0) {
    return <Muted text="0" />;
  }
  return (
    <Tooltip title={`Over the last ${health.windowDays} days, from CloudWatch`}>
      <span>
        <StatusIndicator type="error" size="small">
          {count.toLocaleString()}
        </StatusIndicator>
      </span>
    </Tooltip>
  );
}

/** Views (dashboards) or refresh runs (datasets) over the window. */
export function ActivityCountCell({ id }: { id: string }) {
  const health = useAssetHealth();
  const row = health.byId.get(id);
  const count = row?.viewLoads ?? row?.ingestionRuns;
  if (health.available === false) {
    return <Muted text="no metrics" />;
  }
  if (count === undefined) {
    return <Muted text={health.available === undefined ? '…' : '—'} />;
  }
  return <Typography variant="body2">{count.toLocaleString()}</Typography>;
}
