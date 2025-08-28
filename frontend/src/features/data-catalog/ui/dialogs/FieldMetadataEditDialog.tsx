import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';

import FieldMetadataContent from '../FieldMetadataContent';

interface FieldMetadataEditDialogProps {
  open: boolean;
  onClose: () => void;
  field: any;
  sourceType: 'dataset' | 'analysis' | 'dashboard';
  sourceId: string;
}

export default function FieldMetadataEditDialog({
  open,
  onClose,
  field,
  sourceType,
  sourceId,
}: FieldMetadataEditDialogProps) {
  if (!field || !sourceId) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { 
          height: '90vh',
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">
          Edit Field Metadata: {field.fieldName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {sourceType === 'dataset' && `Dataset: ${sourceId}`}
          {sourceType === 'analysis' && `Analysis: ${sourceId}`}
          {sourceType === 'dashboard' && `Dashboard: ${sourceId}`}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {sourceType !== 'dataset' && field.isCalculated && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is a calculated field defined in {sourceType === 'analysis' ? 'an analysis' : 'a dashboard'}. 
            Metadata is stored separately from dataset fields.
          </Alert>
        )}
        <FieldMetadataContent
          sourceType={sourceType}
          sourceId={sourceId}
          field={{
            name: field.fieldName,
            type: field.dataType,
            expression: field.expression,
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}