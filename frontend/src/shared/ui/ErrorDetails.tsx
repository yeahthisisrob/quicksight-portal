/**
 * Errors say what went wrong in a sentence, and offer the rest: an error
 * snackbar that follows a failed request gets a Details button, and one
 * dialog shows the request, the server's message and what failed
 * underneath (the AWS error, its request id, the portal's request id to
 * find the logs by), with a button to copy it all.
 */
import { ContentCopy } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { type CustomContentProps, closeSnackbar, MaterialDesignContent } from 'notistack';
import { forwardRef, useState, useSyncExternalStore } from 'react';

import { type ApiFailure, failureDetails, recentFailure } from '@/shared/api/failures';

/** The error snackbar: the message, and Details when a request just failed. */
export const ErrorSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  function ErrorSnackbarContent(props, ref) {
    // Taken when it appears: the failure it follows, not whatever fails next.
    const [failure] = useState(() => recentFailure());
    return (
      <MaterialDesignContent
        ref={ref}
        {...props}
        action={
          failure ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                failureDetails.open(failure);
                closeSnackbar(props.id);
              }}
            >
              Details
            </Button>
          ) : (
            props.action
          )
        }
      />
    );
  }
);

function rows(failure: ApiFailure): Array<[string, string]> {
  const d = failure.detail ?? {};
  return [
    ['Request', `${failure.method} ${failure.path}`],
    ['Status', String(failure.status)],
    ['Message', failure.error],
    ...(d.name ? ([['Error', d.name]] as Array<[string, string]>) : []),
    ...(d.cause ? ([['Underneath', d.cause]] as Array<[string, string]>) : []),
    ...(d.awsRequestId
      ? ([
          ['AWS request id', `${d.awsRequestId}${d.awsStatus ? ` (${d.awsStatus})` : ''}`],
        ] as Array<[string, string]>)
      : []),
    ...(d.requestId ? ([['Portal request id', d.requestId]] as Array<[string, string]>) : []),
    ['When', new Date(failure.at).toISOString()],
  ];
}

export function ErrorDetailsView({ failure }: { failure: ApiFailure }) {
  return (
    <Stack spacing={1}>
      {rows(failure).map(([label, value]) => (
        <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', pt: 0.25 }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

/** Mounted once, beside the snackbars: shows the failure someone opened. */
export function ErrorDetailsHost() {
  const failure = useSyncExternalStore(failureDetails.subscribe, failureDetails.current);
  const [copied, setCopied] = useState(false);
  if (!failure) return null;
  const copy = () => {
    void navigator.clipboard
      ?.writeText(
        rows(failure)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      )
      .then(() => setCopied(true));
  };
  return (
    <Dialog
      open
      onClose={() => {
        setCopied(false);
        failureDetails.close();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>What went wrong</DialogTitle>
      <DialogContent dividers>
        <ErrorDetailsView failure={failure} />
      </DialogContent>
      <DialogActions>
        <Button startIcon={<ContentCopy fontSize="small" />} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setCopied(false);
            failureDetails.close();
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
