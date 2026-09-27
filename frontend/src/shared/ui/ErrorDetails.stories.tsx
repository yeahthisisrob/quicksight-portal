import { Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SnackbarProvider, useSnackbar } from 'notistack';

import { type ApiFailure, recordFailure } from '@/shared/api/failures';

import { ErrorDetailsHost, ErrorDetailsView, ErrorSnackbar } from './ErrorDetails';

/**
 * An error says what went wrong in a sentence; Details shows the request,
 * the server's message and what failed underneath, to copy into a report.
 */
const meta: Meta<typeof ErrorDetailsView> = {
  title: 'Shared/Error details',
  component: ErrorDetailsView,
};

export default meta;
type Story = StoryObj<typeof meta>;

const FAILURE: ApiFailure = {
  at: Date.parse('2026-09-26T21:40:00.000Z'),
  method: 'GET',
  path: '/api/playbooks/runs/job-1/items',
  status: 500,
  error: 'Could not read the rows',
  detail: {
    name: 'ValidationException',
    cause: 'STRING_VALUE can not be converted to an Integer',
    awsRequestId: 'Q2F1R3N0M0VQ',
    awsStatus: 400,
    requestId: 'c9f1e3a2-5b7d-4e0f-9a61-2f3b4c5d6e7f',
  },
};

export const Details: Story = { args: { failure: FAILURE } };

function Trigger() {
  const { enqueueSnackbar } = useSnackbar();
  return (
    <Button
      variant="outlined"
      onClick={() => {
        recordFailure({ ...FAILURE, at: Date.now() });
        enqueueSnackbar('Could not read the rows', { variant: 'error', persist: true });
      }}
    >
      Fail a request
    </Button>
  );
}

/** Click to fail a request: the error snackbar offers Details. */
export const Snackbar: Story = {
  args: { failure: FAILURE },
  render: () => (
    <SnackbarProvider Components={{ error: ErrorSnackbar }}>
      <Trigger />
      <ErrorDetailsHost />
    </SnackbarProvider>
  ),
};
