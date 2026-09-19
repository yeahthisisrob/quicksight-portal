import { TimelineFeed } from '@/features/activity';
import { DataExportView } from '@/features/data-export';

/** The export console: run and watch exports, with the activity feed beside it. */
export function ExportPanel() {
  return <DataExportView embedded timelineFeed={<TimelineFeed />} />;
}

export default ExportPanel;
