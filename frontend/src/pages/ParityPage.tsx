import { Box } from '@mui/material';

import { AwsParity, PARITY_CHECKED } from '@/features/aws-parity';

import { PageHeader } from '@/shared/design-system';

/**
 * The portal and AWS side by side, gaps on both sides. The matrix is the
 * record of both: a portal gap closes here when it ships.
 */
export default function ParityPage() {
  return (
    <Box sx={{ maxWidth: 1180 }}>
      <PageHeader
        title="Parity with AWS"
        description={`The portal and AWS side by side, gaps on both sides. Checked ${PARITY_CHECKED}.`}
      />
      <AwsParity />
    </Box>
  );
}
