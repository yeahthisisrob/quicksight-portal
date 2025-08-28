import { chipIcons } from '@/shared/ui/icons';

export type ChipType = 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE' | 'FOLDER' | 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC' | 'FIELDS' | 'CALCULATED_FIELDS' | 'VISUALS' | 'SHEETS' | 'FILTERS' | 'EXPRESSIONS' | 'UNKNOWN' | 'TAG' | 'CATALOG_HIDDEN' | 'PORTAL_HIDDEN' | 'RELATIONSHIP';

export const chipConfig = {
  // Asset types
  DASHBOARD: { 
    icon: chipIcons.DASHBOARD, 
    colorKey: 'dashboard' as const,
    label: 'Dashboard',
  },
  ANALYSIS: { 
    icon: chipIcons.ANALYSIS, 
    colorKey: 'analysis' as const,
    label: 'Analysis',
  },
  DATASET: { 
    icon: chipIcons.DATASET, 
    colorKey: 'dataset' as const,
    label: 'Dataset',
  },
  DATASOURCE: { 
    icon: chipIcons.DATASOURCE, 
    colorKey: 'datasource' as const,
    label: 'Data Source',
  },
  FOLDER: { 
    icon: chipIcons.FOLDER, 
    colorKey: 'folder' as const,
    label: 'Folder',
  },
  USER: { 
    icon: chipIcons.USER, 
    colorKey: 'user' as const,
    label: 'User',
  },
  GROUP: { 
    icon: chipIcons.GROUP, 
    colorKey: 'group' as const,
    label: 'Group',
  },
  NAMESPACE: {
    icon: chipIcons.NAMESPACE,
    colorKey: 'namespace' as const,
    label: 'Namespace',
  },
  PUBLIC: {
    icon: chipIcons.PUBLIC,
    colorKey: 'public' as const,
    label: 'Public',
  },
  
  // JSON Viewer highlight types
  FIELDS: {
    icon: chipIcons.FIELDS,
    label: 'Fields',
    jsonHighlight: true,
  },
  CALCULATED_FIELDS: {
    icon: chipIcons.CALCULATED_FIELDS,
    label: 'Calculated Fields',
    jsonHighlight: true,
  },
  VISUALS: {
    icon: chipIcons.VISUALS,
    label: 'Visuals',
    jsonHighlight: true,
  },
  SHEETS: {
    icon: chipIcons.SHEETS,
    label: 'Sheets',
    jsonHighlight: true,
  },
  FILTERS: {
    icon: chipIcons.FILTERS,
    label: 'Filters',
    jsonHighlight: true,
  },
  EXPRESSIONS: {
    icon: chipIcons.EXPRESSIONS,
    label: 'Expressions',
    jsonHighlight: true,
  },
  
  // Status types
  UNKNOWN: {
    icon: chipIcons.UNKNOWN,
    label: 'Unknown',
    statusType: true,
  },
  
  // Tag types
  TAG: {
    icon: chipIcons.TAG,
    label: 'Tag',
    tagType: true,
  },
  CATALOG_HIDDEN: {
    icon: chipIcons.CATALOG_HIDDEN,
    label: 'Catalog Hidden',
    tagType: true,
    specialTag: 'warning',
  },
  PORTAL_HIDDEN: {
    icon: chipIcons.PORTAL_HIDDEN,
    label: 'Portal Hidden',
    tagType: true,
    specialTag: 'error',
  },
  
  // Relationship type
  RELATIONSHIP: {
    icon: chipIcons.RELATIONSHIP,
    label: 'Relationship',
    relationshipType: true,
  },
} as const;