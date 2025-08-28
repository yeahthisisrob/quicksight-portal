import { 
  Dashboard, 
  Dataset, 
  Analytics, 
  Source, 
  Folder, 
  Person, 
  Group,
  Palette
} from '@mui/icons-material';

export const assetTypeConfig = {
  dashboards: { 
    label: 'Dashboards', 
    color: '#1976d2',
    description: 'Export all dashboard definitions and configurations',
    icon: Dashboard
  },
  datasets: { 
    label: 'Datasets', 
    color: '#388e3c',
    description: 'Export dataset definitions, schemas, and configurations',
    icon: Dataset
  },
  analyses: { 
    label: 'Analyses', 
    color: '#7b1fa2',
    description: 'Export all analysis definitions and configurations',
    icon: Analytics
  },
  datasources: { 
    label: 'Data Sources', 
    color: '#f57c00',
    description: 'Export data source connections and configurations',
    icon: Source
  },
    folders: { 
    label: 'Folders', 
    color: '#795548',
    description: 'Export folder structure and permissions',
    icon: Folder
  },
  groups: { 
    label: 'Groups', 
    color: '#5d4037',
    description: 'Export user groups and permissions',
    icon: Group
  },
  users: { 
    label: 'Users', 
    color: '#00796b',
    description: 'Export user configurations and assignments',
    icon: Person
  },
  themes: { 
    label: 'Themes', 
    color: '#9e9e9e',
    description: 'Export custom theme definitions (Coming Soon)',
    icon: Palette,
    disabled: true,
    comingSoon: true
  }
} as const;