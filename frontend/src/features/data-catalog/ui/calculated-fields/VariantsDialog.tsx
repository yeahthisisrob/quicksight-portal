/**
 * The variants behind a count in the grid: every expression carrying this
 * field's name, side by side, with "Open" to land on one in the detail pane.
 */
import { Close } from '@mui/icons-material';
import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

import { getApiErrorMessage } from '@/shared/api';

import { useCalculatedField } from '../../lib/useFieldCatalog';
import { VariantGrid } from './VariantCard';

interface VariantsDialogProps {
  /** The field whose variants to show; closed when absent. */
  fieldKey?: string;
  onClose: () => void;
  onOpenField: (key: string) => void;
}

const SKELETON_CARDS = 2;
const SKELETON_HEIGHT = 120;

export function VariantsDialog({ fieldKey, onClose, onOpenField }: VariantsDialogProps) {
  const detail = useCalculatedField(fieldKey);
  const data = detail.data;
  return (
    <Dialog open={Boolean(fieldKey)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        <Typography variant="h6" component="span" sx={{ fontFamily: 'monospace' }}>
          {data?.name ?? 'Variants'}
        </Typography>
        {data && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {data.variants.length} expressions carry this name
          </Typography>
        )}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {detail.isError ? (
          <Alert severity="error">{getApiErrorMessage(detail.error, 'Unknown error')}</Alert>
        ) : data ? (
          <VariantGrid
            variants={data.variants}
            currentKey={data.key}
            onOpen={(key) => {
              onOpenField(key);
              onClose();
            }}
          />
        ) : (
          <Stack spacing={1.5}>
            {Array.from({ length: SKELETON_CARDS }, (_, i) => (
              <Skeleton key={i} variant="rectangular" height={SKELETON_HEIGHT} />
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
