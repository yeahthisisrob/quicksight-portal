/**
 * The edits made so far, in the order they apply, each removable.
 */
import { Close } from '@mui/icons-material';
import { Chip, IconButton, List, ListItem, ListItemText, Typography } from '@mui/material';

import type { DefinitionOp, SheetOutline } from '@/shared/api/modules/authoring';

import { CHANGE_KIND_LABELS, describeOp, opChangeKind } from '../../lib/ops';

interface OpsListProps {
  ops: DefinitionOp[];
  outline: SheetOutline[] | null;
  onRemove: (index: number) => void;
}

export function OpsList({ ops, outline, onRemove }: OpsListProps) {
  if (ops.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No edits yet. Click a card on the After view, or ask the planner for changes.
      </Typography>
    );
  }
  return (
    <List dense disablePadding data-testid="ops-list">
      {ops.map((op, index) => (
        <ListItem
          key={`${index}-${op.op}-${op.elementId ?? op.sheetId}`}
          disableGutters
          secondaryAction={
            <IconButton
              edge="end"
              size="small"
              aria-label={`Remove edit ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <Close fontSize="small" />
            </IconButton>
          }
        >
          <Chip
            size="small"
            variant="outlined"
            label={CHANGE_KIND_LABELS[opChangeKind(op)]}
            sx={{ mr: 1, minWidth: 64 }}
          />
          <ListItemText
            primary={describeOp(op, outline)}
            slotProps={{ primary: { variant: 'body2' } }}
          />
        </ListItem>
      ))}
    </List>
  );
}
