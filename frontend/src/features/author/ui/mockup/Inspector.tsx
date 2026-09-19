/**
 * The mockup editor's inspector: the selected card's title, type, position
 * and size, plus duplicate and remove. Every change becomes a DefinitionOp
 * on the flow; the preview re-runs and the wireframe redraws from it.
 */
import {
  ArrowBack,
  ArrowDownward,
  ArrowForward,
  ArrowUpward,
  ContentCopy,
  DeleteOutlined,
  Edit,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { type KeyboardEvent, useEffect, useState } from 'react';

import type { DefinitionOp, SheetOutline } from '@/shared/api/modules/authoring';
import { Container } from '@/shared/design-system';

import {
  clampCol,
  clampColSpan,
  clampRow,
  clampRowSpan,
  findOutlineElement,
  isRetypable,
  RETYPABLE_TYPES,
  typeWords,
} from '../../lib/ops';
import { swapOps } from '../../lib/swap';
import type { SelectedElement } from '../../model/authorFlow';

const NUMBER_WIDTH = 104;

interface InspectorProps {
  outline: SheetOutline[];
  sheetId: string;
  selected: SelectedElement | null;
  onOps: (ops: DefinitionOp[]) => void;
  onClearSelection: () => void;
}

function commitOnEnter(commit: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };
}

function SheetSection({ sheet, onOps }: { sheet: SheetOutline; onOps: InspectorProps['onOps'] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sheet.name);
  useEffect(() => setName(sheet.name), [sheet.name]);

  const commit = () => {
    const next = name.trim();
    if (next && next !== sheet.name) {
      onOps([{ op: 'renameSheet', sheetId: sheet.sheetId, name: next }]);
    }
    setEditing(false);
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        Sheet
      </Typography>
      {editing ? (
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={commitOnEnter(commit)}
            autoFocus
            fullWidth
            slotProps={{ htmlInput: { 'aria-label': 'Sheet name' } }}
          />
          <Button size="small" variant="contained" onClick={commit}>
            Save
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {sheet.name}
          </Typography>
          <Button size="small" startIcon={<Edit />} onClick={() => setEditing(true)}>
            Rename sheet
          </Button>
        </Stack>
      )}
    </Box>
  );
}

function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed) && parsed !== value) {
      onCommit(parsed);
    } else {
      setText(String(value));
    }
  };
  return (
    <TextField
      size="small"
      label={label}
      type="number"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={commitOnEnter(commit)}
      slotProps={{ htmlInput: { min, max, 'aria-label': label } }}
      sx={{ width: NUMBER_WIDTH }}
    />
  );
}

function ElementForm({
  sheet,
  element,
  onOps,
}: {
  sheet: SheetOutline;
  element: NonNullable<ReturnType<typeof findOutlineElement>>['element'];
  onOps: InspectorProps['onOps'];
}) {
  const base = { sheetId: sheet.sheetId, elementId: element.elementId };
  const [title, setTitle] = useState(element.title ?? '');
  const [subtitle, setSubtitle] = useState('');
  const [copyTitle, setCopyTitle] = useState(`${element.title ?? 'Untitled'} (copy)`);
  useEffect(() => {
    setTitle(element.title ?? '');
    setCopyTitle(`${element.title ?? 'Untitled'} (copy)`);
  }, [element.title]);

  const isVisual = element.kind === 'visual';
  const grid = sheet.layout === 'grid';
  const col = element.col ?? 0;
  const row = element.row ?? 0;
  const colSpan = element.colSpan ?? 1;
  const rowSpan = element.rowSpan ?? 1;

  const commitTitle = () => {
    const next = title.trim();
    if (next !== (element.title ?? '')) {
      onOps([{ op: 'retitle', ...base, title: next }]);
    }
  };
  // The outline carries no subtitle, so remember what was last sent to avoid
  // a duplicate op on every blur.
  const [sentSubtitle, setSentSubtitle] = useState('');
  const commitSubtitle = () => {
    const next = subtitle.trim();
    if (next !== sentSubtitle) {
      setSentSubtitle(next);
      onOps([{ op: 'retitle', ...base, subtitle: next }]);
    }
  };
  const move = (c: number, r: number) =>
    onOps([{ op: 'move', ...base, col: clampCol(c), row: clampRow(r) }]);
  // Arrows trade places with the neighbour in that direction; a nudge only
  // when there is nothing there, so visuals never slide onto each other.
  const swap = (direction: 'up' | 'down' | 'left' | 'right') =>
    onOps(swapOps(sheet, element.elementId, direction, { col: clampCol, row: clampRow }));
  const resize = (cs: number, rs: number) =>
    onOps([{ op: 'resize', ...base, colSpan: clampColSpan(cs, col), rowSpan: clampRowSpan(rs) }]);

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {element.title ?? element.elementId}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={typeWords(element.visualType ?? element.kind)}
          />
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
          {element.elementId}
        </Typography>
      </Box>

      {isVisual && (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={commitOnEnter(commitTitle)}
            fullWidth
          />
          <TextField
            size="small"
            label="Subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            onBlur={commitSubtitle}
            onKeyDown={commitOnEnter(commitSubtitle)}
            placeholder="Add a subtitle"
            fullWidth
          />
        </Stack>
      )}

      {isVisual && isRetypable(element.visualType) && (
        <FormControl size="small" fullWidth>
          <InputLabel id="inspector-visual-type">Visual type</InputLabel>
          <Select
            labelId="inspector-visual-type"
            label="Visual type"
            value={element.visualType}
            onChange={(e) =>
              onOps([
                {
                  op: 'retype',
                  ...base,
                  visualType: e.target.value as DefinitionOp['visualType'],
                },
              ])
            }
          >
            {RETYPABLE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Field wells, title and subtitle carry over; axis, legend and sort settings reset.
          </FormHelperText>
        </FormControl>
      )}

      <Divider />

      {grid ? (
        <Stack spacing={1.5}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Position (36-column grid)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <NumberField label="Col" value={col} min={0} max={35} onCommit={(c) => move(c, row)} />
            <NumberField label="Row" value={row} min={0} onCommit={(r) => move(col, r)} />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
              Swap with neighbour
            </Typography>
            <Tooltip title="Swap left">
              <IconButton size="small" aria-label="Swap left" onClick={() => swap('left')}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Swap right">
              <IconButton size="small" aria-label="Swap right" onClick={() => swap('right')}>
                <ArrowForward fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Swap up">
              <IconButton size="small" aria-label="Swap up" onClick={() => swap('up')}>
                <ArrowUpward fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Swap down">
              <IconButton size="small" aria-label="Swap down" onClick={() => swap('down')}>
                <ArrowDownward fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Size
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <NumberField
              label="Cols"
              value={colSpan}
              min={1}
              max={36}
              onCommit={(cs) => resize(cs, rowSpan)}
            />
            <NumberField
              label="Rows"
              value={rowSpan}
              min={1}
              onCommit={(rs) => resize(colSpan, rs)}
            />
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            <Button size="small" onClick={() => resize(colSpan - 1, rowSpan)}>
              Narrower
            </Button>
            <Button size="small" onClick={() => resize(colSpan + 1, rowSpan)}>
              Wider
            </Button>
            <Button size="small" onClick={() => resize(colSpan, rowSpan - 1)}>
              Shorter
            </Button>
            <Button size="small" onClick={() => resize(colSpan, rowSpan + 1)}>
              Taller
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Only grid layouts can be repositioned here; this sheet is {sheet.layout}.
        </Typography>
      )}

      <Divider />

      {isVisual && (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Title for the copy"
            value={copyTitle}
            onChange={(e) => setCopyTitle(e.target.value)}
            fullWidth
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopy />}
            onClick={() =>
              onOps([
                {
                  op: 'duplicate',
                  ...base,
                  title: copyTitle.trim() || undefined,
                  ...(grid ? { col, row: row + rowSpan } : {}),
                },
              ])
            }
          >
            Duplicate
          </Button>
        </Stack>
      )}
      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={<DeleteOutlined />}
        onClick={() => onOps([{ op: 'remove', ...base }])}
      >
        Remove
      </Button>
    </Stack>
  );
}

export function Inspector({ outline, sheetId, selected, onOps, onClearSelection }: InspectorProps) {
  const sheet = outline.find((s) => s.sheetId === sheetId) ?? outline[0];
  const hit = selected ? findOutlineElement(outline, selected.sheetId, selected.elementId) : null;

  return (
    <Container
      header="Inspector"
      headingLevel="h3"
      description={hit ? undefined : 'Click a card on the After view to edit it.'}
      actions={
        hit && (
          <Button size="small" onClick={onClearSelection}>
            Done
          </Button>
        )
      }
      sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}
    >
      <Stack spacing={2} data-testid="inspector">
        {sheet && <SheetSection sheet={sheet} onOps={onOps} />}
        {sheet && hit && (
          <>
            <Divider />
            <ElementForm
              key={`${hit.sheet.sheetId}/${hit.element.elementId}`}
              sheet={hit.sheet}
              element={hit.element}
              onOps={onOps}
            />
          </>
        )}
      </Stack>
    </Container>
  );
}
