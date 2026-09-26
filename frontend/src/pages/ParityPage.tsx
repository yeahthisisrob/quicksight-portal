import { Box } from '@mui/material';

import { AwsParity, PARITY_CHECKED } from '@/features/aws-parity';

import { PageHeader } from '@/shared/design-system';

/**
 * What the portal adds to QuickSight, beside what AWS offers today. Where
 * AWS does the same (or has announced it), the row says so and the portal
 * points there once it can do the job.
 */
export default function ParityPage() {
  return (
    <Box sx={{ maxWidth: 1180 }}>
      <PageHeader
        title="Parity with AWS"
        description={`What the portal adds to QuickSight, and what AWS offers today. Where AWS does the same, the portal points there. Checked ${PARITY_CHECKED}.`}
      />
      <AwsParity />
    </Box>
  );
}
