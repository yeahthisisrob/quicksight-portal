import type { JobStatus } from '@/shared/api/modules/jobs';
import { StatusIndicator } from '@/shared/design-system';

import { JOB_STATUS_TONE } from '../model/jobPresentation';

/** A job's status as the design system's indicator: one tone and word per status. */
export function JobStatusIndicator({
  status,
  size = 'small',
}: {
  status: JobStatus;
  size?: 'small' | 'medium';
}) {
  const tone = JOB_STATUS_TONE[status] ?? JOB_STATUS_TONE.queued;
  return (
    <StatusIndicator type={tone.type} size={size}>
      {tone.label}
    </StatusIndicator>
  );
}
