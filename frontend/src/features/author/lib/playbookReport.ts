/**
 * A playbook report as files: CSV for a spreadsheet (one row per asset, the
 * run's facts in the first lines), JSON for everything.
 */
import type { PlaybookReport } from '@/shared/api/modules/playbooks';
import { dataToCSV, type ExportColumn } from '@/shared/lib/exportUtils';

type Row = PlaybookReport['items'][number];

const COLUMNS: ExportColumn[] = [
  { id: 'assetType', label: 'Type' },
  { id: 'assetId', label: 'Id' },
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status' },
  { id: 'verdict', label: 'Found' },
  { id: 'summary', label: 'Why / what happened', getValue: (r: Row) => r.error ?? r.summary },
  { id: 'changes', label: 'Changes' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'updatedAt', label: 'At' },
];

const SLUG = /[^a-z0-9]+/g;

export function reportFilename(report: PlaybookReport, extension: 'csv' | 'json'): string {
  const title = report.playbookTitle.toLowerCase().replace(SLUG, '-').replace(/^-|-$/g, '');
  const day = (report.endTime ?? report.startTime).slice(0, 10);
  return `${title}-${report.mode}-${day}.${extension}`;
}

export function reportCsv(report: PlaybookReport): string {
  const facts = [
    ['Playbook', report.playbookTitle],
    ['Mode', report.mode],
    ['Status', report.status],
    ['Started by', report.startedBy ?? ''],
    ['Started', report.startTime],
    ['Inputs', JSON.stringify(report.params)],
  ].map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`);
  return [...facts, '', dataToCSV(report.items, COLUMNS)].join('\n');
}
