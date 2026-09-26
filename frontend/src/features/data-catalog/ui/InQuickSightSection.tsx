import { Button, Chip, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { SaveTemplateDialog } from '@/entities/template';

import type {
  CatalogDataset,
  DatasetCatalogField,
  SmusCatalogAsset,
} from '@/shared/api/modules/data-catalog';
import { Container, EmptyState, TabBar } from '@/shared/design-system';

import { DatasetFieldsTable } from './DatasetFieldsTable';
import ExpressionGraphDialog from './dialogs/ExpressionGraphDialog';
import FieldMetadataEditDialog from './dialogs/FieldMetadataEditDialog';

interface InQuickSightSectionProps {
  asset: SmusCatalogAsset;
}

const MATCH_LABEL: Record<CatalogDataset['matchType'], string> = {
  'source-table': 'matched by source table',
  'custom-sql': 'matched by custom SQL',
  name: 'matched by name',
  lineage: 'matched through a parent dataset',
};

type Open =
  | { kind: 'note'; dataset: CatalogDataset; field: DatasetCatalogField }
  | { kind: 'lineage'; dataset: CatalogDataset; field: DatasetCatalogField }
  | { kind: 'template'; dataset: CatalogDataset; field: DatasetCatalogField }
  | null;

/**
 * What only QuickSight knows: the datasets reading this asset, their
 * calculated fields, and where each field is used. Calculated fields carry
 * a portal-stored note because SMUS has no home for them.
 */
export function InQuickSightSection({ asset }: InQuickSightSectionProps) {
  // The generated type intersects the summary's `datasets` with the detail's,
  // and TypeScript keeps the narrower summary shape; the detail is what the
  // endpoint returns.
  const datasets = asset.datasets as CatalogDataset[];
  const [tab, setTab] = useState<string>(datasets[0]?.id ?? '');
  const [focusedField, setFocusedField] = useState<string | undefined>();
  const [open, setOpen] = useState<Open>(null);

  const current = datasets.find((d) => d.id === tab) ?? datasets[0];

  if (!current) {
    return (
      <Container header="In QuickSight" headingLevel="h3">
        <EmptyState
          compact
          title="No QuickSight dataset reads this asset yet"
          description="Create one in Author: it builds a dataset over the published table through an existing data source, so this asset can back a dashboard."
          action={
            <Button component={RouterLink} to="/author" variant="contained" size="small">
              Open Author
            </Button>
          }
        />
      </Container>
    );
  }

  const actions = {
    onEditNote: (field: DatasetCatalogField) => setOpen({ kind: 'note', dataset: current, field }),
    onLineage: (field: DatasetCatalogField) =>
      setOpen({ kind: 'lineage', dataset: current, field }),
    onSaveTemplate: (field: DatasetCatalogField) =>
      setOpen({ kind: 'template', dataset: current, field }),
    onJump: (name: string) => {
      setFocusedField(undefined);
      // Re-set on the next tick so jumping to the same field twice still scrolls.
      window.setTimeout(() => setFocusedField(name), 0);
    },
  };

  return (
    <Container
      header="In QuickSight"
      headingLevel="h3"
      description="Datasets reading this asset, their calculated fields, and where each field is used. Only calculated fields take a note here; SMUS describes the rest."
      disableContentPadding
    >
      <Stack spacing={0}>
        {datasets.length > 1 && (
          <TabBar
            ariaLabel="Datasets"
            value={current.id}
            onChange={(next) => {
              setTab(next);
              setFocusedField(undefined);
            }}
            tabs={datasets.map((d) => ({
              value: d.id,
              label: d.name,
              badge: d.calculatedFieldCount || undefined,
            }))}
          />
        )}
        <Stack
          direction="row"
          spacing={1}
          sx={{ px: 2, pt: 2, pb: 1, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography variant="subtitle2">{current.name}</Typography>
          <Chip size="small" variant="outlined" label={MATCH_LABEL[current.matchType]} />
          {current.importMode && (
            <Chip size="small" variant="outlined" label={current.importMode} />
          )}
          <Chip
            size="small"
            variant="outlined"
            label={`${current.calculatedFieldCount} calculated`}
          />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', ml: 'auto', fontFamily: 'monospace' }}
          >
            {current.id}
          </Typography>
        </Stack>
        <DatasetFieldsTable dataset={current} focusedField={focusedField} actions={actions} />
      </Stack>

      {open?.kind === 'note' && (
        <FieldMetadataEditDialog
          open
          onClose={() => setOpen(null)}
          sourceType="dataset"
          sourceId={open.dataset.id}
          field={{
            fieldName: open.field.name,
            dataType: open.field.dataType,
            expression: open.field.expression,
            isCalculated: open.field.isCalculated,
          }}
        />
      )}
      {open?.kind === 'lineage' && (
        <ExpressionGraphDialog
          open
          onClose={() => setOpen(null)}
          dataset={open.dataset}
          fieldName={open.field.name}
        />
      )}
      {open?.kind === 'template' && (
        <SaveTemplateDialog
          open
          onClose={() => setOpen(null)}
          templateId={open.field.template?.id}
          initial={{
            name: open.field.name,
            expression: open.field.expression ?? '',
            dataType: open.field.dataType,
            description: open.field.portal?.description,
            tags: open.field.portal?.tags,
            source: {
              datasetId: open.dataset.id,
              datasetName: open.dataset.name,
              listingId: asset.listingId,
            },
          }}
        />
      )}
    </Container>
  );
}
