/**
 * Validation section component for RestoreAssetDialog
 */
import { Alert, Box, CircularProgress, Divider, Stack, Typography } from '@mui/material';

import { statusIcons } from '@/shared/ui/icons';

import type { ValidationResult } from '@/shared/api/modules/deploy';

const WarningIcon = statusIcons.warning;
const InfoIcon = statusIcons.info;

interface ValidationSectionProps {
  validationResults: ValidationResult[];
  validating: boolean;
  hasRequiredFields: boolean;
}

function getValidationIcon(result: ValidationResult) {
  if (result.passed) return null;
  return result.severity === 'error' ? (
    <WarningIcon color="error" fontSize="small" />
  ) : (
    <InfoIcon color="warning" fontSize="small" />
  );
}

export function ValidationSection({ 
  validationResults, 
  validating, 
  hasRequiredFields 
}: ValidationSectionProps) {
  if (validating) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="info" icon={<CircularProgress size={20} />}>
          Validating asset restore configuration...
        </Alert>
      </Box>
    );
  }

  if (validationResults.length > 0) {
    return (
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          Validation Results
        </Typography>
        <Stack spacing={1}>
          {validationResults.map((result, index) => (
            <Alert
              key={index}
              severity={result.passed ? 'success' : result.severity}
              icon={getValidationIcon(result)}
            >
              {result.message}
            </Alert>
          ))}
        </Stack>
      </Box>
    );
  }

  if (!validating && validationResults.length === 0 && hasRequiredFields) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="info">
          Validation will happen automatically. You can also click "Validate" to check manually.
        </Alert>
      </Box>
    );
  }

  return null;
}