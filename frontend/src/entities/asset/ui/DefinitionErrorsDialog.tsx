import { Close as CloseIcon, Error as ErrorIcon } from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
} from '@mui/material';

interface DefinitionError {
  type: string;
  message: string;
  violatedEntities?: Array<{
    path: string;
  }>;
}

interface DefinitionErrorsDialogProps {
  open: boolean;
  onClose: () => void;
  assetName: string;
  assetType: 'dashboard' | 'analysis';
  errors: DefinitionError[];
}

const getErrorSeverity = (errorType: string): 'error' | 'warning' => {
  // You can customize this based on error types
  if (errorType.includes('NOT_FOUND') || errorType.includes('INVALID')) {
    return 'error';
  }
  return 'warning';
};

const formatErrorType = (type: string): string => {
  // Convert snake_case to human readable
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function DefinitionErrorsDialog({
  open,
  onClose,
  assetName,
  assetType,
  errors,
}: DefinitionErrorsDialogProps) {
  const groupedErrors = errors.reduce((acc, error) => {
    if (!acc[error.type]) {
      acc[error.type] = [];
    }
    acc[error.type].push(error);
    return acc;
  }, {} as Record<string, DefinitionError[]>);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="error" />
          <Typography variant="h6" component="div">
            Definition Errors
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {assetType.charAt(0).toUpperCase() + assetType.slice(1)}: {assetName}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The following errors were found in the {assetType} definition. These may prevent 
          the {assetType} from functioning correctly.
        </Typography>
        
        {Object.entries(groupedErrors).map(([errorType, errorList]) => (
          <Box key={errorType} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label={formatErrorType(errorType)}
                color={getErrorSeverity(errorType)}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                ({errorList.length} {errorList.length === 1 ? 'error' : 'errors'})
              </Typography>
            </Box>
            
            <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              {errorList.map((error, idx) => (
                <div key={idx}>
                  <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {error.message}
                        </Typography>
                      }
                      secondary={
                        error.violatedEntities && error.violatedEntities.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Affected entities:
                            </Typography>
                            {error.violatedEntities.map((entity, entityIdx) => (
                              <Typography 
                                key={entityIdx} 
                                variant="caption" 
                                sx={{ 
                                  display: 'block',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  color: 'text.secondary',
                                  ml: 1
                                }}
                              >
                                {entity.path}
                              </Typography>
                            ))}
                          </Box>
                        )
                      }
                    />
                  </ListItem>
                  {idx < errorList.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          </Box>
        ))}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}