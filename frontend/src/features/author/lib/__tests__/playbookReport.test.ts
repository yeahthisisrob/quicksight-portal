import { describe, expect, it } from 'vitest';

import type { PlaybookReport } from '@/shared/api/modules/playbooks';

import { reportCsv, reportFilename } from '../playbookReport';

const report: PlaybookReport = {
  jobId: 'playbook-1',
  playbookId: 'consolidate-athena',
  playbookTitle: 'Consolidate Athena data sources',
  mode: 'run',
  status: 'completed',
  startedBy: 'rob@example.com',
  startTime: '2026-09-26T14:00:00Z',
  endTime: '2026-09-26T14:05:00Z',
  params: { target: 'athena-main' },
  counts: {
    total: 2,
    pending: 0,
    planned: 0,
    done: 1,
    failed: 1,
    skipped: 0,
    review: 0,
    verdicts: { change: 2, review: 0, skip: 0 },
  },
  items: [
    {
      key: '000#dataset#a',
      stage: 0,
      assetType: 'dataset',
      assetId: 'a',
      name: 'orders "gold"',
      status: 'done',
      verdict: 'change',
      summary: 'Moved 1 table',
      changes: ['orders: old → main', 'lines: old → main'],
      updatedAt: '2026-09-26T14:01:00Z',
    },
    {
      key: '000#dataset#b',
      stage: 0,
      assetType: 'dataset',
      assetId: 'b',
      name: 'pipeline',
      status: 'failed',
      verdict: 'change',
      error: 'Column x not found',
      updatedAt: '2026-09-26T14:02:00Z',
    },
  ],
};

describe('playbook reports as files', () => {
  it('names the file after the playbook, the mode and the day', () => {
    expect(reportFilename(report, 'csv')).toBe(
      'consolidate-athena-data-sources-run-2026-09-26.csv'
    );
  });

  it('writes the run’s facts, then a row per asset, errors in place of the summary', () => {
    const csv = reportCsv(report);
    expect(csv.split('\n')[0]).toBe('"Playbook","Consolidate Athena data sources"');
    expect(csv).toContain('"Inputs","{""target"":""athena-main""}"');
    expect(csv).toContain('"orders ""gold"""');
    expect(csv).toContain('"orders: old → main; lines: old → main"');
    expect(csv).toContain('"Column x not found"');
  });
});
