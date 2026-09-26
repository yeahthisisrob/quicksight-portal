/**
 * A preview's or run's report: download it (CSV for a spreadsheet, JSON for
 * everything) or save it, so it outlives the jobs' 30 days.
 */
import { BookmarkAddOutlined, Download } from '@mui/icons-material';
import { Button, CircularProgress, Stack } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { getApiErrorMessage, playbooksApi } from '@/shared/api';
import { downloadCSV, downloadFile } from '@/shared/lib/exportUtils';

import { reportCsv, reportFilename } from '../../lib/playbookReport';

export function ReportActions({ jobId }: { jobId: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const onError = (e: unknown) =>
    enqueueSnackbar(getApiErrorMessage(e, 'The report could not be made'), { variant: 'error' });

  const download = useMutation({
    mutationFn: async (format: 'csv' | 'json') => ({
      format,
      report: await playbooksApi.report(jobId),
    }),
    onSuccess: ({ format, report }) => {
      if (format === 'csv') downloadCSV(reportCsv(report), reportFilename(report, 'csv'));
      else
        downloadFile(
          JSON.stringify(report, null, 2),
          reportFilename(report, 'json'),
          'application/json'
        );
    },
    onError,
  });
  const save = useMutation({
    mutationFn: () => playbooksApi.saveReport(jobId),
    onSuccess: () => {
      enqueueSnackbar('Report saved; it is under Saved reports', { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['playbook-reports'] });
    },
    onError,
  });
  const busy = download.isPending || save.isPending;
  const spinner = <CircularProgress size={14} color="inherit" />;

  return (
    <Stack direction="row" spacing={1}>
      <Button
        size="small"
        startIcon={download.isPending ? spinner : <Download />}
        disabled={busy}
        onClick={() => download.mutate('csv')}
      >
        CSV
      </Button>
      <Button
        size="small"
        startIcon={<Download />}
        disabled={busy}
        onClick={() => download.mutate('json')}
      >
        JSON
      </Button>
      <Button
        size="small"
        startIcon={save.isPending ? spinner : <BookmarkAddOutlined />}
        disabled={busy}
        onClick={() => save.mutate()}
      >
        Save report
      </Button>
    </Stack>
  );
}
