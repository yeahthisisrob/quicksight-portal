/**
 * Expression tab for calculated field details
 */
import {
  ContentCopy as CopyIcon,
  OpenInFull as ExpandIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { DatasourceTypeBadge } from '@/entities/field';

interface ExpressionTabProps {
  field: any;
  hasVariants: boolean;
  currentExpression: string;
  onCopyExpression: () => void;
  onShowGraph: () => void;
}

export function ExpressionTab({ 
  field, 
  hasVariants, 
  currentExpression,
  onCopyExpression,
  onShowGraph
}: ExpressionTabProps) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  
  const renderExpression = (expression: string | undefined) => {
    if (!expression) return null;
    
    return (
      <Box
        sx={{
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: 1.8,
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          position: 'relative',
        }}
      >
        <code>{expression}</code>
      </Box>
    );
  };
  
  return (
    <Stack spacing={3}>
      {/* Variant Selector */}
      {hasVariants && field.expressions?.length > 1 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Expression Variants
          </Typography>
          <Tabs
            value={selectedVariant}
            onChange={(_, newValue) => setSelectedVariant(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mt: 1 }}
          >
            {field.expressions.map((_: any, index: number) => (
              <Tab key={index} label={`Variant ${index + 1}`} />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* Expression Content */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Expression
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Copy Expression">
              <IconButton size="small" onClick={onCopyExpression}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Expression Graph">
              <IconButton size="small" onClick={onShowGraph}>
                <ExpandIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        
        {renderExpression(currentExpression)}
        
        {/* Expression Metadata */}
        {field.expressions?.[selectedVariant] && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            {field.expressions[selectedVariant].datasourceTypes?.map((type: string) => (
              <DatasourceTypeBadge key={type} datasourceType={type} />
            ))}
            {field.expressions[selectedVariant].assetCount && (
              <Chip 
                label={`Used in ${field.expressions[selectedVariant].assetCount} assets`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        )}
      </Paper>

      {/* Expression Warnings */}
      {hasVariants && field.expressions?.length > 1 && (
        <Alert severity="warning">
          <Typography variant="subtitle2" gutterBottom>
            Multiple Expression Variants Detected
          </Typography>
          <Typography variant="body2">
            This calculated field has {field.expressions.length} different expression variants 
            across your assets. This might indicate inconsistent business logic.
          </Typography>
        </Alert>
      )}
      
      {/* Graph Button */}
      <Box>
        <Button
          variant="outlined"
          startIcon={<ExpandIcon />}
          onClick={onShowGraph}
          fullWidth
        >
          View Expression Dependency Graph
        </Button>
      </Box>
    </Stack>
  );
}