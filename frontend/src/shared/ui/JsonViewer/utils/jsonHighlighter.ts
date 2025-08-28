/**
 * JSON highlighting utilities
 */
import { alpha } from '@mui/material';

import { colors } from '@/shared/design-system/theme';

export type HighlightType = 
  | 'FIELDS' 
  | 'CALCULATED_FIELDS' 
  | 'VISUALS' 
  | 'SHEETS' 
  | 'DATASET' 
  | 'DATASOURCE' 
  | 'FILTERS' 
  | 'EXPRESSIONS' 
  | null;

export const highlightConfigs = {
  FIELDS: {
    patterns: [/FieldId/gi, /ColumnIdentifier/gi, /FieldName/gi, /Column/gi],
    jumpTo: null,
  },
  CALCULATED_FIELDS: {
    patterns: [/CalculatedField/gi, /Expression/gi, /CalculatedColumn/gi],
    jumpTo: '"CalculatedFields"',
  },
  VISUALS: {
    patterns: [/Visual/gi, /ChartConfiguration/gi, /BarChart/gi, /LineChart/gi, /PieChart/gi, /Table/gi, /PivotTable/gi, /KPIVisual/gi],
    jumpTo: '"Visuals"',
  },
  SHEETS: {
    patterns: [/Sheet/gi, /Layout/gi, /GridLayout/gi],
    jumpTo: '"Sheets"',
  },
  DATASET: {
    patterns: [/DataSet/gi, /DataSetIdentifier/gi],
    jumpTo: '"DataSetIdentifierDeclarations"',
  },
  DATASOURCE: {
    patterns: [/DataSource/gi, /DataSourceArn/gi],
    jumpTo: null,
  },
  FILTERS: {
    patterns: [/Filter/gi, /ParameterControl/gi, /FilterGroup/gi],
    jumpTo: '"FilterGroups"',
  },
  EXPRESSIONS: {
    patterns: [/Expression/gi, /Aggregation/gi, /AggregateFunction/gi],
    jumpTo: null,
  },
} as const;

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Apply highlight type patterns
 */
function applyHighlightPatterns(text: string, highlightType: HighlightType): string {
  if (!highlightType) return text;
  
  let highlighted = text;
  const config = highlightConfigs[highlightType];
  
  config.patterns.forEach(pattern => {
    highlighted = highlighted.replace(pattern, (match) => 
      `<mark class="highlight-${highlightType}">${match}</mark>`
    );
  });
  
  return highlighted;
}

/**
 * Apply search term highlighting
 */
function applySearchHighlight(text: string, searchTerm: string): string {
  if (!searchTerm) return text;
  
  const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchPattern = new RegExp(escapedSearchTerm, 'gi');
  
  return text.replace(searchPattern, (match) => 
    `<mark class="highlight-search">${match}</mark>`
  );
}

/**
 * Main highlight function
 */
export function highlightJson(text: string, highlightType: HighlightType, searchTerm: string): string {
  if (!highlightType && !searchTerm) return text;
  
  let highlighted = escapeHtml(text);
  highlighted = applyHighlightPatterns(highlighted, highlightType);
  highlighted = applySearchHighlight(highlighted, searchTerm);
  
  return highlighted;
}

/**
 * Get highlight styles for styled components
 */
export function getHighlightStyles() {
  return {
    '& mark.highlight-FIELDS': {
      backgroundColor: alpha(colors.assetTypes.dashboard.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-CALCULATED_FIELDS': {
      backgroundColor: alpha(colors.assetTypes.analysis.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-VISUALS': {
      backgroundColor: alpha(colors.assetTypes.dashboard.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-SHEETS': {
      backgroundColor: alpha(colors.assetTypes.folder.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-DATASET': {
      backgroundColor: alpha(colors.assetTypes.dataset.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-DATASOURCE': {
      backgroundColor: alpha(colors.assetTypes.datasource.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-FILTERS': {
      backgroundColor: alpha(colors.assetTypes.analysis.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-EXPRESSIONS': {
      backgroundColor: alpha(colors.assetTypes.folder.main, 0.2),
      color: 'inherit',
    },
    '& mark.highlight-search': {
      backgroundColor: alpha(colors.status.warning, 0.35),
      color: 'inherit',
      fontWeight: 600,
      border: `1px solid ${alpha(colors.status.warning, 0.3)}`,
    },
  };
}