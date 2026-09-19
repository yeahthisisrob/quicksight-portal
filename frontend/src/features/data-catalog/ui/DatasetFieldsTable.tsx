import {
  AccountTree,
  BookmarkAdd,
  BookmarkAdded,
  EditNote,
  ExpandLess,
  ExpandMore,
  Functions,
  OpenInNew,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import type { CatalogDataset, DatasetCatalogField } from '@/shared/api/modules/data-catalog';
import { pal, StatusIndicator } from '@/shared/design-system';

export interface FieldActions {
  onEditNote: (field: DatasetCatalogField) => void;
  onLineage: (field: DatasetCatalogField) => void;
  onSaveTemplate: (field: DatasetCatalogField) => void;
  /** Move focus to another field in this table (expands and scrolls to it). */
  onJump: (fieldName: string) => void;
}

interface DatasetFieldsTableProps {
  dataset: CatalogDataset;
  focusedField?: string;
  actions: FieldActions;
}

function UsageCell({ field }: { field: DatasetCatalogField }) {
  const total = field.usage.dashboards + field.usage.analyses;
  if (total === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Unused
      </Typography>
    );
  }
  const parts: string[] = [];
  if (field.usage.dashboards)
    parts.push(`${field.usage.dashboards} dashboard${field.usage.dashboards === 1 ? '' : 's'}`);
  if (field.usage.analyses)
    parts.push(`${field.usage.analyses} analys${field.usage.analyses === 1 ? 'is' : 'es'}`);
  return <Typography variant="body2">{parts.join(', ')}</Typography>;
}

function FieldChips({
  label,
  names,
  onJump,
}: {
  label: string;
  names: string[];
  onJump: (name: string) => void;
}) {
  if (names.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
        {label}
      </Typography>
      {names.map((name) => (
        <Chip
          key={name}
          size="small"
          variant="outlined"
          label={name}
          onClick={() => onJump(name)}
          sx={{ fontFamily: 'monospace' }}
        />
      ))}
    </Stack>
  );
}

function ConflictPanel({ field }: { field: DatasetCatalogField }) {
  if (!field.conflict) return null;
  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        border: `1px solid ${pal(theme).tone.warning.border}`,
        bgcolor: pal(theme).tone.warning.bg,
        borderRadius: `${theme.shape.borderRadius}px`,
      })}
    >
      <StatusIndicator type="warning">
        {field.conflict.count} definitions of “{field.name}” across assets
      </StatusIndicator>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 1 }}
      >
        The dataset's own expression is the reference. Each variant lists where it is defined so a
        person can decide which is canonical.
      </Typography>
      <Stack spacing={1}>
        {field.conflict.variants.map((variant, index) => {
          const canonical = variant.expression === field.expression;
          return (
            <Box
              key={`${index}-${variant.expression}`}
              sx={(theme) => ({
                p: 1,
                bgcolor: pal(theme).surface.container,
                border: `1px solid ${canonical ? pal(theme).brand.primary : pal(theme).line.divider}`,
                borderRadius: `${theme.shape.borderRadius}px`,
              })}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                {canonical ? (
                  <Chip size="small" color="primary" label="reference (this dataset)" />
                ) : (
                  <Chip size="small" variant="outlined" label={`variant ${index + 1}`} />
                )}
                {variant.sources.map((s) => (
                  <Chip
                    key={`${s.assetType}:${s.assetId}`}
                    size="small"
                    variant="outlined"
                    label={`${s.assetName} · ${s.assetType}`}
                  />
                ))}
              </Stack>
              <Typography
                component="pre"
                variant="body2"
                sx={{
                  m: 0,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {variant.expression}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function VisualsList({ field }: { field: DatasetCatalogField }) {
  const visuals = field.visuals ?? [];
  if (visuals.length === 0) return null;
  const byAsset = new Map<string, typeof visuals>();
  for (const v of visuals) {
    const key = `${v.assetType}:${v.assetId}`;
    byAsset.set(key, [...(byAsset.get(key) ?? []), v]);
  }
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Shown in
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
        {[...byAsset.values()].map((group) => {
          const first = group[0]!;
          return (
            <Stack
              key={`${first.assetType}:${first.assetId}`}
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
            >
              <Chip size="small" label={`${first.assetName} · ${first.assetType}`} />
              {group.map((v) => (
                <Chip
                  key={v.visualId}
                  size="small"
                  variant="outlined"
                  label={v.sheetName ? `${v.sheetName} › ${v.visualName}` : v.visualName}
                />
              ))}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function FieldRow({
  field,
  focused,
  actions,
}: {
  field: DatasetCatalogField;
  focused: boolean;
  actions: FieldActions;
}) {
  const [open, setOpen] = useState(focused);
  const ref = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (focused) {
      setOpen(true);
      ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [focused]);

  const expandable =
    field.isCalculated ||
    field.usedIn.length > 0 ||
    field.usedBy.length > 0 ||
    Boolean(field.smus?.description) ||
    Boolean(field.portal?.description);

  return (
    <>
      <TableRow
        ref={ref}
        hover
        sx={(theme) => ({ bgcolor: focused ? pal(theme).surface.selected : undefined })}
      >
        <TableCell sx={{ width: 40, pr: 0 }}>
          {expandable && (
            <IconButton size="small" onClick={() => setOpen((o) => !o)} aria-label="Details">
              {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {field.name}
            </Typography>
            {field.isCalculated && (
              <Tooltip title="Calculated field">
                <Functions fontSize="inherit" sx={{ color: 'text.secondary' }} />
              </Tooltip>
            )}
            {field.conflict && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={`${field.conflict.count} definitions`}
              />
            )}
            {field.template && (
              <Tooltip title="Matches a saved template">
                <BookmarkAdded fontSize="inherit" sx={{ color: 'text.secondary' }} />
              </Tooltip>
            )}
          </Stack>
          {(field.isCalculated ? field.portal?.description : field.smus?.description) && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {field.isCalculated ? field.portal?.description : field.smus?.description}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {field.dataType}
        </TableCell>
        <TableCell>
          <UsageCell field={field} />
        </TableCell>
        <TableCell align="right" sx={{ width: 140, whiteSpace: 'nowrap' }}>
          {field.isCalculated && (
            <>
              <Tooltip title="Lineage: what it reads, what reads it">
                <IconButton
                  size="small"
                  onClick={() => actions.onLineage(field)}
                  aria-label="Lineage"
                >
                  <AccountTree fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={field.template ? 'Update template' : 'Save as template'}>
                <IconButton
                  size="small"
                  onClick={() => actions.onSaveTemplate(field)}
                  aria-label="Save as template"
                >
                  {field.template ? (
                    <BookmarkAdded fontSize="small" />
                  ) : (
                    <BookmarkAdd fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit the portal's note">
                <IconButton
                  size="small"
                  onClick={() => actions.onEditNote(field)}
                  aria-label="Edit note"
                >
                  <EditNote fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {!field.isCalculated && field.smus?.url && (
            <Tooltip title="Open the column in SMUS">
              <IconButton
                size="small"
                component="a"
                href={field.smus.url}
                target="_blank"
                rel="noopener"
                aria-label="Open in SMUS"
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
      {expandable && (
        <TableRow>
          <TableCell colSpan={5} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
            <Collapse in={open} unmountOnExit>
              <Stack spacing={1.5} sx={{ py: 1.5, pl: 5, pr: 2 }}>
                {field.expression && (
                  <Box
                    component="pre"
                    sx={(theme) => ({
                      m: 0,
                      p: 1.5,
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      bgcolor: pal(theme).surface.page,
                      border: `1px solid ${pal(theme).line.divider}`,
                      borderRadius: `${theme.shape.borderRadius}px`,
                    })}
                  >
                    {field.expression}
                  </Box>
                )}
                <ConflictPanel field={field} />
                <FieldChips label="Reads" names={field.references} onJump={actions.onJump} />
                <FieldChips label="Read by" names={field.usedBy} onJump={actions.onJump} />
                <VisualsList field={field} />
                {field.usedIn.length > 0 && !field.visuals?.length && (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                      Used in
                    </Typography>
                    {field.usedIn.map((u) => (
                      <Chip
                        key={`${u.assetType}:${u.assetId}`}
                        size="small"
                        variant="outlined"
                        label={`${u.assetName} · ${u.assetType}`}
                      />
                    ))}
                  </Stack>
                )}
                {!field.isCalculated && field.smus && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Described in SMUS as column{' '}
                    <Box component="span" sx={{ fontFamily: 'monospace' }}>
                      {field.smus.columnName}
                    </Box>
                    {field.smus.url && (
                      <>
                        {' · '}
                        <Link href={field.smus.url} target="_blank" rel="noopener">
                          Open in SMUS
                        </Link>
                      </>
                    )}
                  </Typography>
                )}
                {field.isCalculated && field.portal?.tags && field.portal.tags.length > 0 && (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                      Portal tags
                    </Typography>
                    {field.portal.tags.map((t) => (
                      <Chip key={t} size="small" label={t} />
                    ))}
                    {field.portal.sensitivity && (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={field.portal.sensitivity}
                      />
                    )}
                  </Stack>
                )}
                {field.isCalculated && (
                  <Box>
                    <Button
                      size="small"
                      startIcon={<AccountTree />}
                      onClick={() => actions.onLineage(field)}
                    >
                      Open lineage
                    </Button>
                  </Box>
                )}
              </Stack>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** One dataset's fields: SMUS describes the plain ones; the portal notes the calculated ones. */
export function DatasetFieldsTable({ dataset, focusedField, actions }: DatasetFieldsTableProps) {
  const sorted = [...dataset.fields].sort(
    (a, b) => Number(b.isCalculated) - Number(a.isCalculated) || a.name.localeCompare(b.name)
  );
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 40 }} />
          <TableCell>Field</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Usage</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {sorted.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            focused={field.name === focusedField}
            actions={actions}
          />
        ))}
      </TableBody>
    </Table>
  );
}
