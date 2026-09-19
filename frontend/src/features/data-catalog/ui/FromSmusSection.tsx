import {
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import type { SmusCatalogAsset } from '@/shared/api/modules/data-catalog';
import { Container, KeyValuePairs } from '@/shared/design-system';

interface FromSmusSectionProps {
  asset: SmusCatalogAsset;
}

/**
 * What SMUS owns about the asset. Read-only on purpose: the glossary, the
 * forms and the column descriptions are edited in SMUS, and this page shows
 * them as they are.
 */
export function FromSmusSection({ asset }: FromSmusSectionProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        From SageMaker Unified Studio. Edit these in SMUS; the portal only reads them.
      </Typography>

      <Container header="Glossary terms" headingLevel="h3">
        {asset.glossaryTerms.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No glossary terms are attached to this asset.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {asset.glossaryTerms.map((term) => (
              <Stack key={term.name} direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
                <Chip size="small" label={term.name} />
                {term.shortDescription && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {term.shortDescription}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Container>

      {asset.forms.map((form) => (
        <Container key={form.name} header={form.name} headingLevel="h3" variant="subtle">
          <KeyValuePairs
            columns={2}
            items={form.fields.map((f) => ({ label: f.key, value: f.value || '—' }))}
            emptyText="This form has no fields."
          />
        </Container>
      ))}

      <Container
        header="Columns"
        headingLevel="h3"
        description={asset.table ? `${asset.table.database}.${asset.table.name}` : undefined}
        disableContentPadding
      >
        {asset.columns.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>
            The listing's metadata forms carry no columns.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Column</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {asset.columns.map((column) => (
                <TableRow key={column.name} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{column.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                    {column.type}
                  </TableCell>
                  <TableCell sx={{ color: column.description ? 'text.primary' : 'text.secondary' }}>
                    {column.description ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Container>
    </Stack>
  );
}
