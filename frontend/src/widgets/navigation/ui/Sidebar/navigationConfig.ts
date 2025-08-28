import { NavigationIconType } from '@/shared/ui/icons';

export interface NavigationItem {
  text: string;
  icon: NavigationIconType;
  path: string;
  colorKey?: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group';
}

export interface NavigationSection {
  title?: string;
  divider?: boolean;
  items: NavigationItem[];
}

export const navigationConfig: NavigationSection[] = [
  {
    title: 'Assets',
    items: [
      { 
        text: 'Dashboards', 
        icon: 'dashboard', 
        path: '/assets/dashboards',
        colorKey: 'dashboard'
      },
      { 
        text: 'Analyses', 
        icon: 'analysis', 
        path: '/assets/analyses',
        colorKey: 'analysis'
      },
      { 
        text: 'Datasets', 
        icon: 'dataset', 
        path: '/assets/datasets',
        colorKey: 'dataset'
      },
      { 
        text: 'Datasources', 
        icon: 'datasource', 
        path: '/assets/datasources',
        colorKey: 'datasource'
      },
    ],
  },
  {
    title: 'Organization',
    divider: true,
    items: [
      { 
        text: 'Folders', 
        icon: 'folder', 
        path: '/assets/folders',
        colorKey: 'folder'
      },
      { 
        text: 'Users', 
        icon: 'user', 
        path: '/assets/users',
        colorKey: 'user'
      },
      { 
        text: 'Groups', 
        icon: 'group', 
        path: '/assets/groups',
        colorKey: 'group'
      },
      { 
        text: 'Ingestions', 
        icon: 'storage', 
        path: '/ingestions'
      },
    ],
  },
  {
    title: 'Tools',
    divider: true,
    items: [
      { 
        text: 'Data Catalog', 
        icon: 'dataCatalog', 
        path: '/data-catalog'
      },
      { 
        text: 'Export Assets', 
        icon: 'exportManagement', 
        path: '/export'
      },
      { 
        text: 'Archived Assets', 
        icon: 'archive', 
        path: '/archived-assets'
      },
      { 
        text: 'Scripts', 
        icon: 'code', 
        path: '/scripts'
      },
    ],
  },
];