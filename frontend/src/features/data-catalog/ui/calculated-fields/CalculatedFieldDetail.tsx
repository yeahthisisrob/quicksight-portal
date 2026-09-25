/**
 * One calculated field: the expression, the whole dependency chain it sits
 * in, its immediate lineage both ways, where it is used down to the visual,
 * and its variants side by side. The SMUS tie-back is on the columns it
 * reads: description and glossary terms come from the listing column, the
 * note from the portal.
 */
import {
  AccountTree,
  Close,
  CollectionsBookmark,
  Edit,
  Notes,
  OpenInFull,
  OpenInNew,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { FieldLineageGraph } from '@/entities/field';

import type {
  CalculatedFieldRef,
  CalculatedFieldDetail as Detail,
  LineageRead,
} from '@/shared/api/modules/data-catalog';
import { Container, EmptyState, pal } from '@/shared/design-system';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import { prettyExpression } from '../../model/fieldCatalog';
import FieldMetadataEditDialog from '../dialogs/FieldMetadataEditDialog';
import { SaveTemplateDialog } from '../templates/SaveTemplateDialog';
import { assetPath } from './assetPath';
import { FieldUsagePanel } from './FieldUsagePanel';

interface CalculatedFieldDetailProps {
  detail?: Detail;
  loading?: boolean;
  error?: string | null;
  onOpenField: (key: string) => void;
  onOpenListing: (listingId: string) => void;
  onClose?: () => void;
}

const SKELETON_LINES = 6;
const CHAIN_DIALOG_HEIGHT = 640;

function AssetChip({ asset }: { asset: CalculatedFieldRef }) {
  const consoleUrl = getQuickSightConsoleUrl(asset.type, asset.id);
  return (
    <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
      <Chip
        size="small"
        variant="outlined"
        component={RouterLink}
        to={assetPath(asset)}
        clickable
        label={asset.name}
        icon={
          <Typography variant="caption" component="span" sx={{ pl: 0.75 }}>
            {asset.type}
          </Typography>
        }
      />
      {consoleUrl && (
        <Tooltip title="Open in QuickSight">
          <IconButton
            size="small"
            component="a"
            href={consoleUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${asset.name} in QuickSight`}
          >
            <OpenInNew fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

function Expression({ expression }: { expression: string }) {
  return (
    <Box
      component="pre"
      sx={(theme) => ({
        m: 0,
        px: 1.5,
        py: 1.25,
        fontFamily: 'monospace',
        fontSize: theme.typography.body2.fontSize,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        bgcolor: pal(theme).surface.hover,
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
      })}
    >
      {prettyExpression(expression)}
    </Box>
  );
}

function ReadRow({
  read,
  onOpenField,
  onOpenListing,
}: {
  read: LineageRead;
  onOpenField: (key: string) => void;
  onOpenListing: (listingId: string) => void;
}) {
  return (
    <Box
      sx={(theme) => ({
        py: 1,
        borderBottom: `1px solid ${pal(theme).line.divider}`,
        '&:last-of-type': { borderBottom: 0 },
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
        {read.kind === 'calculated' && read.key ? (
          <Link
            component="button"
            type="button"
            variant="body2"
            sx={{ fontWeight: 600, fontFamily: 'monospace' }}
            onClick={() => onOpenField(read.key as string)}
          >
            {read.name}
          </Link>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
            {read.name}
          </Typography>
        )}
        <Chip
          size="small"
          variant="outlined"
          label={read.kind === 'calculated' ? 'calculated field' : 'column'}
        />
        {read.dataType && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {read.dataType.toLowerCase()}
          </Typography>
        )}
        {read.datasetName && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            in {read.datasetName}
          </Typography>
        )}
      </Stack>
      {read.smus && (
        <Stack spacing={0.25} sx={{ mt: 0.5, pl: 0.25 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
          >
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              clickable
              onClick={() => onOpenListing(read.smus?.listingId ?? '')}
              label={`SMUS: ${read.smus.name}${read.smus.columnName ? `.${read.smus.columnName}` : ''}`}
            />
            {read.smus.glossaryTerms.map((term) => (
              <Chip key={term} size="small" label={term} />
            ))}
            {read.smus.url && (
              <Link href={read.smus.url} target="_blank" rel="noreferrer" variant="caption">
                Open in SMUS
              </Link>
            )}
          </Stack>
          {read.smus.description && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {read.smus.description}
            </Typography>
          )}
        </Stack>
      )}
      {!read.smus && read.kind === 'column' && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
          Not tied to a SMUS column
        </Typography>
      )}
    </Box>
  );
}

function DetailSkeleton() {
  return (
    <Stack spacing={1.5} sx={{ p: 2 }}>
      <Skeleton variant="text" width="40%" height={32} />
      <Skeleton variant="rectangular" height={88} />
      {Array.from({ length: SKELETON_LINES }, (_, i) => (
        <Skeleton key={i} variant="text" />
      ))}
    </Stack>
  );
}

export function CalculatedFieldDetail({
  detail,
  loading,
  error,
  onOpenField,
  onOpenListing,
  onClose,
}: CalculatedFieldDetailProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);

  if (loading) {
    return (
      <Container header={<Skeleton width={160} />}>
        <DetailSkeleton />
      </Container>
    );
  }
  if (error) {
    return (
      <Container header="Calculated field">
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  if (!detail) {
    return (
      <Container header="Calculated field">
        <EmptyState
          compact
          title="Pick a calculated field"
          description="Its expression, what it reads (with the SMUS column behind each), what reads it, where it is used, and every variant under the same name."
        />
      </Container>
    );
  }

  const noteSource = detail.definedIn.find((d) => d.type === 'dataset') ?? detail.definedIn[0];

  return (
    <Container
      header={
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
        >
          <Typography variant="h6" component="h2" sx={{ fontFamily: 'monospace' }}>
            {detail.name}
          </Typography>
          {detail.dataType && (
            <Chip size="small" variant="outlined" label={detail.dataType.toLowerCase()} />
          )}
          {detail.template ? (
            <Chip
              size="small"
              color="primary"
              icon={<CollectionsBookmark />}
              label="Template"
              component={RouterLink}
              to="/data-catalog?tab=smus&templates=1"
              clickable
            />
          ) : null}
          {detail.conflict && (
            <Chip
              size="small"
              color="warning"
              label={`${detail.conflict.variants + 1} variants of this name`}
            />
          )}
        </Stack>
      }
      description={`Defined in ${detail.definedIn.length} ${detail.definedIn.length === 1 ? 'asset' : 'assets'} · used by ${detail.usedBy.dashboards} dashboards, ${detail.usedBy.analyses} analyses, ${detail.usedBy.visuals} visuals`}
      actions={
        <Stack direction="row" spacing={1}>
          {!detail.template && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CollectionsBookmark />}
              onClick={() => setSavingTemplate(true)}
            >
              Save as template
            </Button>
          )}
          {noteSource && (
            <Button
              size="small"
              variant="outlined"
              startIcon={detail.portal ? <Edit /> : <Notes />}
              onClick={() => setEditingNote(true)}
            >
              {detail.portal ? 'Edit note' : 'Add note'}
            </Button>
          )}
          {onClose && (
            <Button size="small" onClick={onClose}>
              Close
            </Button>
          )}
        </Stack>
      }
    >
      <Stack spacing={3}>
        <Box>
          <Expression expression={detail.expression} />
          {detail.portal?.description && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {detail.portal.description}
            </Typography>
          )}
          {(detail.portal?.tags?.length ||
            detail.portal?.category ||
            detail.portal?.sensitivity) && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {detail.portal?.category && <Chip size="small" label={detail.portal.category} />}
              {detail.portal?.sensitivity && (
                <Chip size="small" color="warning" label={detail.portal.sensitivity} />
              )}
              {detail.portal?.tags?.map((tag) => (
                <Chip key={tag} size="small" variant="outlined" label={tag} />
              ))}
            </Stack>
          )}
        </Box>

        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', mb: 1, justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <AccountTree fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2">Dependency chain</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                the columns it comes from, and everything computed from it
              </Typography>
            </Stack>
            {detail.lineage.nodes.length > 1 && (
              <Tooltip title="Open the chain full screen">
                <IconButton
                  size="small"
                  aria-label="Open the dependency chain full screen"
                  onClick={() => setChainOpen(true)}
                >
                  <OpenInFull fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <FieldLineageGraph
            lineage={detail.lineage}
            focusKey={detail.key}
            onOpenField={onOpenField}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Reads {detail.reads.length === 0 ? 'nothing' : ''}
            </Typography>
            {detail.reads.map((read) => (
              <ReadRow
                key={`${read.kind}:${read.name}:${read.datasetId ?? ''}`}
                read={read}
                onOpenField={onOpenField}
                onOpenListing={onOpenListing}
              />
            ))}
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Read by {detail.readBy.length === 0 ? 'no other calculated field' : ''}
            </Typography>
            {detail.readBy.map((reader) => (
              <Box
                key={reader.key}
                sx={(theme) => ({
                  py: 1,
                  borderBottom: `1px solid ${pal(theme).line.divider}`,
                  '&:last-of-type': { borderBottom: 0 },
                })}
              >
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                  onClick={() => onOpenField(reader.key)}
                >
                  {reader.name}
                </Link>
                <Typography
                  variant="caption"
                  component="code"
                  sx={{
                    display: 'block',
                    fontFamily: 'monospace',
                    color: 'text.secondary',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {reader.expression}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Defined in
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {detail.definedIn.map((asset) => (
              <AssetChip key={`${asset.type}:${asset.id}`} asset={asset} />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Used in
          </Typography>
          <FieldUsagePanel usedIn={detail.usedIn} visuals={detail.visuals} />
        </Box>

        {detail.variants.length > 1 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Variants of {detail.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              The same name computed differently. Pick the one that should win, save it as the
              template, and Author will offer it when it adds calculated fields.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(280px, 1fr))' },
                gap: 1.5,
              }}
            >
              {detail.variants.map((variant) => {
                const current = variant.key === detail.key;
                return (
                  <Box
                    key={variant.key}
                    sx={(theme) => ({
                      p: 1.5,
                      border: `1px solid ${current ? pal(theme).brand.primary : pal(theme).line.divider}`,
                      borderRadius: `${theme.shape.borderRadius}px`,
                      bgcolor: current ? pal(theme).surface.selected : undefined,
                    })}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
                        {current ? 'This one' : `Defined in ${variant.definedIn.length}`}
                      </Typography>
                      {!current && (
                        <Button size="small" onClick={() => onOpenField(variant.key)}>
                          Open
                        </Button>
                      )}
                    </Stack>
                    <Expression expression={variant.expression} />
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {variant.definedIn.map((asset) => (
                        <Chip
                          key={`${asset.type}:${asset.id}`}
                          size="small"
                          variant="outlined"
                          label={`${asset.type}: ${asset.name}`}
                        />
                      ))}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Stack>

      {chainOpen && detail && (
        <Dialog open onClose={() => setChainOpen(false)} maxWidth="xl" fullWidth>
          <DialogTitle sx={{ pr: 6 }}>
            <Typography variant="h6" component="span" sx={{ fontFamily: 'monospace' }}>
              {detail.name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              The whole dependency chain. Click any calculated field to open it.
            </Typography>
            <IconButton
              aria-label="Close"
              onClick={() => setChainOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <FieldLineageGraph
              lineage={detail.lineage}
              focusKey={detail.key}
              maxHeight={CHAIN_DIALOG_HEIGHT}
              onOpenField={(key) => {
                setChainOpen(false);
                onOpenField(key);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      {savingTemplate && (
        <SaveTemplateDialog
          open
          onClose={() => setSavingTemplate(false)}
          initial={{
            name: detail.name,
            expression: detail.expression,
            dataType: detail.dataType,
            description: detail.portal?.description,
            source: detail.datasets[0]
              ? { datasetId: detail.datasets[0].id, datasetName: detail.datasets[0].name }
              : undefined,
          }}
        />
      )}
      {editingNote && noteSource && (
        <FieldMetadataEditDialog
          open
          onClose={() => setEditingNote(false)}
          field={{ fieldName: detail.name, ...detail.portal }}
          sourceType={noteSource.type}
          sourceId={noteSource.id}
        />
      )}
    </Container>
  );
}
