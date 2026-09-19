import type { NavigationIconType } from '@/shared/ui/icons';

export interface NavigationItem {
  text: string;
  icon: NavigationIconType;
  path: string;
  /** Tints the active state with the asset's colour. */
  colorKey?: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group';
  /** `prefix` (default) also matches child routes; `exact` matches only the path. */
  match?: 'exact' | 'prefix';
}

export interface NavigationSection {
  title?: string;
  items: NavigationItem[];
}

/** True when the item is the page the user is on. */
export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (pathname === item.path) {
    return true;
  }
  return item.match !== 'exact' && pathname.startsWith(`${item.path}/`);
}

/** The main navigation, top to bottom. */
export const navigationConfig: NavigationSection[] = [
  {
    items: [{ text: 'Activity', icon: 'timeline', path: '/activity' }],
  },
  {
    title: 'Authoring',
    items: [{ text: 'Author', icon: 'author', path: '/author' }],
  },
  {
    title: 'Assets',
    items: [
      { text: 'Dashboards', icon: 'dashboard', path: '/assets/dashboards', colorKey: 'dashboard' },
      { text: 'Analyses', icon: 'analysis', path: '/assets/analyses', colorKey: 'analysis' },
      { text: 'Datasets', icon: 'dataset', path: '/assets/datasets', colorKey: 'dataset' },
      {
        text: 'Datasources',
        icon: 'datasource',
        path: '/assets/datasources',
        colorKey: 'datasource',
      },
    ],
  },
  {
    title: 'Organization',
    items: [
      { text: 'Folders', icon: 'folder', path: '/assets/folders', colorKey: 'folder' },
      { text: 'Users', icon: 'user', path: '/assets/users', colorKey: 'user' },
      { text: 'Groups', icon: 'group', path: '/assets/groups', colorKey: 'group' },
      { text: 'Ingestions', icon: 'storage', path: '/ingestions' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { text: 'Data Catalog', icon: 'dataCatalog', path: '/data-catalog' },
      { text: 'Operations', icon: 'operations', path: '/operations' },
    ],
  },
];

/** Pinned to the bottom of the navigation. */
export const utilityNavigation: NavigationItem[] = [
  { text: 'Settings', icon: 'settings', path: '/settings' },
];
