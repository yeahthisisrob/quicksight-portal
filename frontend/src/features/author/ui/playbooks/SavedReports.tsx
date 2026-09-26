/**
 * Reports someone saved, newest first: which playbook, preview or run, how
 * it went. One opens with every row, and can be downloaded again.
 */
import { Download } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import { getApiErrorMessage, playbooksApi } from '@/shared/api';
import type { PlaybookReport, PlaybookReportSummary } from '@/shared/api/modules/playbooks';
import { downloadCSV } from '@/shared/lib/exportUtils';

import { reportCsv, reportFilename } from '../../lib/playbookReport';
import { Panel } from '../primitives/Panel';
import { PlaybookRows } from './PlaybookRows';

function ReportDialog({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const report = useQuery({
    queryKey: ['playbook-report', jobId],
    queryFn: () => playbooksApi.getReport(jobId),
  });
  const data = report.data as PlaybookReport | undefined;
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {data?.playbookTitle ?? 'Report'}
        {data && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {data.mode === 'run' ? 'Run' : 'Preview'} by {data.startedBy ?? 'someone'} ·{' '}
            {data.message}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {report.error ? (
          <Alert severity="error">
            {getApiErrorMessage(report.error, 'The report could not be read')}
          </Alert>
        ) : (
          <PlaybookRows
            mode={data?.mode ?? 'run'}
            loading={!data}
            page={
              data
                ? {
                    jobId: data.jobId,
                    playbookId: data.playbookId,
                    mode: data.mode,
                    status: 'completed',
                    items: data.items,
                    counts: data.counts,
                  }
                : null
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        {data && (
          <Button
            startIcon={<Download />}
            onClick={() => downloadCSV(reportCsv(data), reportFilename(data, 'csv'))}
          >
            CSV
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function summaryLine(r: PlaybookReportSummary): string {
  const when = r.savedAt ? formatDistanceToNow(Date.parse(r.savedAt), { addSuffix: true }) : '';
  return [r.message, `saved ${when}${r.savedBy ? ` by ${r.savedBy}` : ''}`]
    .filter(Boolean)
    .join(' · ');
}

export function SavedReports() {
  const [open, setOpen] = useState<string | null>(null);
  const reports = useQuery({
    queryKey: ['playbook-reports'],
    queryFn: () => playbooksApi.listReports(),
  });
  const items = reports.data ?? [];
  if (!reports.isLoading && items.length === 0 && !reports.error) return null;
  return (
    <Panel title="Saved reports" description="Previews and runs kept beyond the jobs' 30 days.">
      {reports.error ? (
        <Alert severity="warning">
          {getApiErrorMessage(reports.error, 'Saved reports could not be read')}
        </Alert>
      ) : (
        <List dense disablePadding>
          {items.map((r) => (
            <ListItemButton key={r.jobId} onClick={() => setOpen(r.jobId)} sx={{ borderRadius: 1 }}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.playbookTitle}
                    </Typography>
                    <Chip size="small" variant="outlined" label={r.mode} sx={{ height: 20 }} />
                  </Stack>
                }
                secondary={summaryLine(r)}
              />
            </ListItemButton>
          ))}
        </List>
      )}
      {open && (
        <Box>
          <ReportDialog jobId={open} onClose={() => setOpen(null)} />
        </Box>
      )}
    </Panel>
  );
}
