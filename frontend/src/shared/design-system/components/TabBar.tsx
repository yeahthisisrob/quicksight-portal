import { Badge, Box, Tab, Tabs } from '@mui/material';
import type { ReactNode } from 'react';

interface TabBarItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** A count shown on the tab. */
  badge?: number;
  disabled?: boolean;
}

interface TabBarProps<T extends string> {
  tabs: TabBarItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Actions on the right of the tab row. */
  actions?: ReactNode;
}

/**
 * Tabs that switch between views of one page. Keep the labels to a word or
 * two; the selected tab is the page's current URL, so make it deep-linkable
 * by syncing `value` with a query parameter.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  actions,
}: TabBarProps<T>) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Tabs
        value={value}
        onChange={(_, next: T) => onChange(next)}
        aria-label={ariaLabel}
        sx={{ flex: 1, minWidth: 0 }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            icon={tab.icon as React.ReactElement | undefined}
            iconPosition="start"
            label={
              tab.badge !== undefined ? (
                <Badge
                  badgeContent={tab.badge}
                  color="primary"
                  max={999}
                  sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 1 } }}
                >
                  {tab.label}
                </Badge>
              ) : (
                tab.label
              )
            }
          />
        ))}
      </Tabs>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}
