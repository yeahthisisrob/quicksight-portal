import { TimelineFeed } from '@/features/activity';
import { DataExportView } from '@/features/data-export';

export default function ExportPage() {
  return <DataExportView timelineFeed={<TimelineFeed />} />;
}
