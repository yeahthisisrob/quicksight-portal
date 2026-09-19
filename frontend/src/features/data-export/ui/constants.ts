import {
  Analytics,
  Dashboard,
  Dataset,
  Folder,
  Group,
  Palette,
  Person,
  Source,
} from '@mui/icons-material';

import type { AssetHueKey } from '@/shared/design-system/tokens';

interface ExportAssetTypeConfig {
  label: string;
  /** The asset hue in the design tokens; the colour comes from the theme. */
  hue: AssetHueKey;
  description: string;
  icon: typeof Dashboard;
  disabled?: boolean;
  comingSoon?: boolean;
}

export const assetTypeConfig: Record<string, ExportAssetTypeConfig> = {
  dashboards: {
    label: 'Dashboards',
    hue: 'dashboard',
    description: 'Export all dashboard definitions and configurations',
    icon: Dashboard,
  },
  datasets: {
    label: 'Datasets',
    hue: 'dataset',
    description: 'Export dataset definitions, schemas, and configurations',
    icon: Dataset,
  },
  analyses: {
    label: 'Analyses',
    hue: 'analysis',
    description: 'Export all analysis definitions and configurations',
    icon: Analytics,
  },
  datasources: {
    label: 'Data Sources',
    hue: 'datasource',
    description: 'Export data source connections and configurations',
    icon: Source,
  },
  folders: {
    label: 'Folders',
    hue: 'folder',
    description: 'Export folder structure and permissions',
    icon: Folder,
  },
  groups: {
    label: 'Groups',
    hue: 'group',
    description: 'Export user groups and permissions',
    icon: Group,
  },
  users: {
    label: 'Users',
    hue: 'user',
    description: 'Export user configurations and assignments',
    icon: Person,
  },
  themes: {
    label: 'Themes',
    hue: 'namespace',
    description: 'Export custom theme definitions (Coming Soon)',
    icon: Palette,
    disabled: true,
    comingSoon: true,
  },
};
