export const OPERATIONS_TABS = ['export', 'smus', 'archived', 'scripts'] as const;
export type OperationsTab = (typeof OPERATIONS_TABS)[number];

export const DEFAULT_OPERATIONS_TAB: OperationsTab = 'export';

/** The query parameter that carries the tab, so a tab is a shareable URL. */
export const OPERATIONS_TAB_PARAM = 'tab';

export function isOperationsTab(value: unknown): value is OperationsTab {
  return typeof value === 'string' && (OPERATIONS_TABS as readonly string[]).includes(value);
}

/** Read the tab from `?tab=`; anything unknown falls back to the default. */
export function parseOperationsTab(param: string | null | undefined): OperationsTab {
  return isOperationsTab(param) ? param : DEFAULT_OPERATIONS_TAB;
}

/**
 * The search params to write for a tab. The default tab is left out of the
 * URL so `/operations` and `/operations?tab=export` are the same page.
 */
export function operationsTabSearch(tab: OperationsTab): string {
  return tab === DEFAULT_OPERATIONS_TAB ? '' : `?${OPERATIONS_TAB_PARAM}=${tab}`;
}

/** Where the old standalone routes go. */
export const LEGACY_OPERATIONS_ROUTES: Record<string, OperationsTab> = {
  '/export': 'export',
  '/smus': 'smus',
  '/archived-assets': 'archived',
  '/scripts': 'scripts',
};
