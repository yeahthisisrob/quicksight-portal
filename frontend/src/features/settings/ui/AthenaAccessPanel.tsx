/**
 * AthenaAccessPanel - whether the portal's role can read the governed
 * databases through Athena, which a custom SQL dataset's preview needs to
 * learn the query's columns. Lake Formation hides a table from a principal
 * with no grant on it, so the state is read from the Glue catalog as the
 * role, database by database. The grant is a data lake admin's action, not
 * the portal's: the panel shows the exact one-time command, like the SMUS
 * seat does. Nothing without SMUS: there is nothing governed to check.
 */
import { ContentCopy, Refresh } from '@mui/icons-material';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { getApiErrorMessage } from '@/shared/api';
import { type AthenaAccessReport, settingsApi } from '@/shared/api/modules/settings';
import { Container, StatusIndicator } from '@/shared/design-system';

const ATHENA_ACCESS_QUERY_KEY = ['settings', 'athena-access'] as const;
const NAME_WIDTH = 220;
const COUNT_WIDTH = 110;

type Database = AthenaAccessReport['databases'][number];

const STATUS: Record<
  Database['visible'],
  { type: 'success' | 'warning' | 'error' | 'pending'; label: string }
> = {
  all: { type: 'success', label: 'Readable' },
  some: { type: 'warning', label: 'Partly hidden' },
  none: { type: 'error', label: 'Hidden' },
  unknown: { type: 'pending', label: 'Not checked' },
};

function DatabaseRow({ database }: { database: Database }) {
  const status = STATUS[database.visible];
  const detail =
    database.visible === 'all'
      ? 'Every listing table is visible to the role.'
      : database.hiddenTables.length > 0
        ? `Hidden: ${database.hiddenTables.join(', ')}${database.listings > database.hiddenTables.length && database.visible === 'none' ? ' and more' : ''}`
        : (database.error ?? '');
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={(theme) => ({
        alignItems: 'center',
        py: 1.25,
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-of-type': { borderBottom: 0 },
      })}
    >
      <Box sx={{ minWidth: NAME_WIDTH }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }} noWrap>
          {database.name}
        </Typography>
        {database.catalog && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            catalog {database.catalog}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: COUNT_WIDTH }}>
        {database.listings} listing{database.listings === 1 ? '' : 's'}
      </Typography>
      <Box sx={{ minWidth: COUNT_WIDTH }}>
        <StatusIndicator type={status.type} size="small">
          {status.label}
        </StatusIndicator>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }} noWrap>
        {detail}
      </Typography>
    </Stack>
  );
}

function CommandBlock({
  label,
  lines,
  copyLabel,
}: {
  label: string;
  lines: string[];
  copyLabel: string;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      enqueueSnackbar('Copied', { variant: 'success' });
    } catch {
      enqueueSnackbar('Could not copy; select the text instead', { variant: 'warning' });
    }
  };
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
          {label}
        </Typography>
        <Tooltip title={copyLabel}>
          <IconButton size="small" aria-label={copyLabel} onClick={copy}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        component="pre"
        sx={(theme) => ({
          m: 0,
          px: 1.5,
          py: 1,
          borderRadius: 1,
          backgroundColor: theme.palette.action.hover,
          fontFamily: 'monospace',
          fontSize: theme.typography.body2.fontSize,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        })}
      >
        {lines.join('\n')}
      </Box>
    </Stack>
  );
}

/**
 * Exactly what a data lake admin runs, in both forms: the repository's
 * shortcut, and the plain AWS CLI calls with the role filled in for an
 * admin who has credentials but not the repository. The portal never
 * grants itself.
 */
function GrantCommands({
  role,
  commands,
  awsCli,
}: {
  role: string;
  commands: string[];
  awsCli: string[];
}) {
  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Typography variant="body2">
        A Lake Formation data lake admin runs one of these once, with their own credentials. It
        grants <code>{role}</code> DESCRIBE on each database and SELECT and DESCRIBE on every table
        in it, including tables published later. The portal never grants itself.
      </Typography>
      <CommandBlock
        label="From this repository"
        lines={commands}
        copyLabel="Copy the just command"
      />
      <CommandBlock
        label="With the AWS CLI, from anywhere"
        lines={awsCli}
        copyLabel="Copy the AWS CLI commands"
      />
    </Stack>
  );
}

export function AthenaAccessPanel() {
  const report = useQuery({
    queryKey: ATHENA_ACCESS_QUERY_KEY,
    queryFn: () => settingsApi.athenaAccess(),
  });
  const data = report.data;
  if (data && !data.configured) {
    return null;
  }
  const hidden = data?.databases.filter((d) => d.visible !== 'all').length ?? 0;
  return (
    <Container
      header="Athena access"
      description="A custom SQL dataset's columns are read by running the query through Athena as the portal's role. Lake Formation hides a governed table from a role with no grant on it, which Athena reports as the table not existing. These are the databases behind the published listings, as the role sees them."
      headerAdornment={
        data ? (
          <StatusIndicator type={hidden === 0 ? 'success' : 'warning'} size="small">
            {hidden === 0 ? 'all readable' : `${hidden} of ${data.databases.length} need a grant`}
          </StatusIndicator>
        ) : undefined
      }
      actions={
        <Button
          size="small"
          startIcon={<Refresh />}
          onClick={() => report.refetch()}
          disabled={report.isFetching}
        >
          Check again
        </Button>
      }
    >
      {report.isLoading ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Reading the catalog as the portal's role…
        </Typography>
      ) : report.error ? (
        <Typography variant="body2" sx={{ color: 'error.main' }}>
          {getApiErrorMessage(report.error, "The catalog could not be read as the portal's role.")}
        </Typography>
      ) : data && data.databases.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No published listing names a table yet. Run a SMUS export, then check again.
        </Typography>
      ) : data ? (
        <>
          {data.databases.map((database) => (
            <DatabaseRow key={`${database.catalog ?? ''}|${database.name}`} database={database} />
          ))}
          {data.commands.length > 0 && (
            <GrantCommands role={data.role} commands={data.commands} awsCli={data.awsCli} />
          )}
        </>
      ) : null}
    </Container>
  );
}
