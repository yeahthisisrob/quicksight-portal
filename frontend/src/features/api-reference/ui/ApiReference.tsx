/**
 * Every operation the API serves, searchable, grouped by area, each one
 * opening to its parameters, body, response and the curl to paste. Read
 * from the same contract the API serves at /api/api-docs/openapi, so it
 * cannot drift from what a key can call.
 */
import { ExpandMore, Search } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { Container, EmptyState } from '@/shared/design-system';

import {
  type ApiOperation,
  curlFor,
  groupByArea,
  type HttpMethod,
  searchOperations,
} from '../model/operations';
import { CodeBlock } from './CopyButton';

const METHOD_COLOR: Record<HttpMethod, 'success' | 'primary' | 'warning' | 'error' | 'default'> = {
  GET: 'success',
  POST: 'primary',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'error',
};

function OperationRow({ op }: { op: ApiOperation }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}>
          <Chip
            size="small"
            label={op.method}
            color={METHOD_COLOR[op.method]}
            sx={{ width: 72, fontFamily: 'monospace', fontWeight: 700 }}
          />
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {op.path}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0 }} noWrap>
            {op.summary}
          </Typography>
          {op.job && <Chip size="small" variant="outlined" label="job" />}
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 1.5, pb: 2 }}>
        <Stack spacing={1.5}>
          {op.description && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {op.description}
            </Typography>
          )}
          {op.parameters.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Parameter</TableCell>
                  <TableCell>In</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {op.parameters.map((p) => (
                  <TableRow key={`${p.in}:${p.name}`}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {p.name}
                      {p.required ? '' : '?'}
                    </TableCell>
                    <TableCell>{p.in}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{p.type}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{p.description ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {op.requestBody && <Chip size="small" label={`body: ${op.requestBody}`} />}
            {op.responseSchema && <Chip size="small" label={`data: ${op.responseSchema}`} />}
            {op.job && (
              <Chip size="small" label="returns a jobId: poll /api/jobs/{jobId}, then /result" />
            )}
          </Stack>
          <CodeBlock code={curlFor(op)} label={`Copy curl for ${op.method} ${op.path}`} />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function ApiReference({ operations }: { operations: ApiOperation[] }) {
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchOperations(operations, query), [operations, query]);
  const areas = useMemo(() => groupByArea(hits), [hits]);

  return (
    <Container
      header="Every operation"
      description={`${operations.length} operations, from the contract the API serves. Search by path, words in the summary, a schema name, or an area.`}
    >
      <Stack spacing={2}>
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an operation: calculated fields, rebind, jobs, cached…"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Search operations', 'data-testid': 'api-search' },
          }}
        />
        {areas.length === 0 ? (
          <EmptyState
            compact
            title="Nothing matches"
            description="Try one word, or a path segment like data-catalog."
          />
        ) : (
          areas.map((area) => (
            <Box key={area.area}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {area.area}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {area.operations.length}
                </Typography>
              </Stack>
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                {area.operations.map((op) => (
                  <OperationRow key={op.id} op={op} />
                ))}
              </Box>
            </Box>
          ))
        )}
      </Stack>
    </Container>
  );
}
