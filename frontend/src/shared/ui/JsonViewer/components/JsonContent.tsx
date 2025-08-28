/**
 * JSON content display component
 */
import { Box, alpha } from '@mui/material';
import { forwardRef } from 'react';

import { borderRadius, colors, spacing, typography } from '@/shared/design-system/theme';

import { getHighlightStyles, highlightJson, HighlightType } from '../utils/jsonHighlighter';

interface JsonContentProps {
  data: any;
  highlightType: HighlightType;
  searchTerm: string;
}

/**
 * Format JSON with line numbers
 */
function formatJsonWithLineNumbers(
  jsonString: string, 
  highlightType: HighlightType, 
  searchTerm: string
): string {
  const lines = jsonString.split('\n');
  
  return lines.map((line, index) => {
    const lineNumber = (index + 1).toString().padStart(4, ' ');
    const highlightedLine = highlightJson(line, highlightType, searchTerm);
    return `<span style="color: ${colors.neutral[500]}; user-select: none; margin-right: 16px;">${lineNumber}</span>${highlightedLine}`;
  }).join('\n');
}

export const JsonContent = forwardRef<HTMLDivElement, JsonContentProps>(
  ({ data, highlightType, searchTerm }, ref) => {
    const jsonString = JSON.stringify(data, null, 2);
    const formattedContent = formatJsonWithLineNumbers(jsonString, highlightType, searchTerm);
    const highlightStyles = getHighlightStyles();
    
    return (
      <Box
        ref={ref}
        sx={{
          fontFamily: typography.fontFamily.monospace,
          fontSize: '13px',
          lineHeight: 1.6,
          backgroundColor: colors.neutral[900],
          color: colors.neutral[200],
          borderRadius: `${borderRadius.md}px`,
          border: `1px solid ${alpha(colors.neutral[700], 0.3)}`,
          overflow: 'auto',
          height: '100%',
          boxShadow: `inset 0 2px 4px ${alpha(colors.neutral[900], 0.3)}`,
          '& pre': {
            margin: 0,
            padding: `${spacing.sm}px ${spacing.md}px`,
            display: 'block',
            whiteSpace: 'pre',
            overflowX: 'auto',
          },
          '& mark': {
            padding: '1px 2px',
            borderRadius: '2px',
            fontWeight: 'inherit',
            transition: 'background-color 0.2s',
          },
          ...highlightStyles,
        }}
      >
        <pre dangerouslySetInnerHTML={{ __html: formattedContent }} />
      </Box>
    );
  }
);

JsonContent.displayName = 'JsonContent';