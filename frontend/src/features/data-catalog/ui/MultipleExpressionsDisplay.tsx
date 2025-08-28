import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Warning as WarningIcon,
  AccountTree as GraphIcon,
} from '@mui/icons-material';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
} from '@mui/material';
import { useSnackbar } from 'notistack';

import { deduplicateExpressions } from '@/shared/lib/expressionUtils';

interface Expression {
  expression: string;
  sources: Array<{
    assetType: string;
    assetId: string;
    assetName: string;
  }>;
}

interface MultipleExpressionsDisplayProps {
  expressions?: Expression[];
  primaryExpression?: string;
  compact?: boolean;
  onShowGraph?: (expression: string) => void;
}

export default function MultipleExpressionsDisplay({
  expressions,
  primaryExpression,
  compact = false,
  onShowGraph,
}: MultipleExpressionsDisplayProps) {
  const { enqueueSnackbar } = useSnackbar();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Expression copied to clipboard', { variant: 'info' });
  };

  // Deduplicate expressions using shared utility
  const uniqueExpressions = deduplicateExpressions(expressions || []);

  if (uniqueExpressions.length === 0) {
    if (!primaryExpression) return null;
    
    return (
      <Box>
        <Paper sx={{ p: 2, bgcolor: 'grey.100', position: 'relative' }}>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', pr: 4 }}
          >
            {primaryExpression}
          </Typography>
          <Box sx={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 0.5 }}>
            {onShowGraph && (
              <IconButton
                size="small"
                onClick={() => onShowGraph(primaryExpression)}
                title="View Dependency Graph"
              >
                <GraphIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => copyToClipboard(primaryExpression)}
              title="Copy Expression"
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (compact) {
    return (
      <Chip
        icon={<WarningIcon />}
        label={`${uniqueExpressions.length} variations`}
        size="small"
        color="warning"
        sx={{ ml: 0.5 }}
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <WarningIcon color="warning" fontSize="small" />
        <Typography variant="subtitle2" color="warning.main">
          Multiple Expressions Found ({uniqueExpressions.length} variations)
        </Typography>
      </Stack>
      
      {uniqueExpressions.map((expr, idx) => (
        <Accordion key={idx} defaultExpanded={idx === 0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">
              Variation {idx + 1} - Used in {expr.sources.length} asset{expr.sources.length !== 1 ? 's' : ''}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Used in: {expr.sources.map(s => s.assetName).join(', ')}
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', position: 'relative', mt: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', pr: 4 }}
                >
                  {expr.expression}
                </Typography>
                <Box sx={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 0.5 }}>
                  {onShowGraph && (
                    <IconButton
                      size="small"
                      onClick={() => onShowGraph(expr.expression)}
                      title="View Dependency Graph"
                    >
                      <GraphIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(expr.expression)}
                    title="Copy Expression"
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}