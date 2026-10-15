import { Badge, Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import type { ReactNode } from 'react';

interface SectionNavItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  /** A count shown beside the label (unsaved changes, items needing attention). */
  badge?: number;
  disabled?: boolean;
}

interface SectionNavProps<T extends string> {
  sections: SectionNavItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** The open section's content. */
  children: ReactNode;
  /** The list's width on wide screens. */
  navWidth?: number;
}

const DEFAULT_NAV_WIDTH = 220;

/**
 * A page of sections: the sections listed down the left, the open one on
 * the right. For pages whose sections keep growing (Settings, Operations),
 * where a row of tabs would run out of room. On a narrow screen the list
 * wraps above the content. The open section is the page's current URL, so
 * sync `value` with a query parameter to make it deep-linkable.
 */
export function SectionNav<T extends string>({
  sections,
  value,
  onChange,
  ariaLabel,
  children,
  navWidth = DEFAULT_NAV_WIDTH,
}: SectionNavProps<T>) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        alignItems: 'flex-start',
        minWidth: 0,
      }}
    >
      <List
        component="nav"
        aria-label={ariaLabel}
        dense
        sx={{
          width: { xs: '100%', md: navWidth },
          flexShrink: 0,
          position: { md: 'sticky' },
          top: { md: 16 },
          display: { xs: 'flex', md: 'block' },
          flexWrap: 'wrap',
          gap: { xs: 0.5, md: 0 },
          p: 0,
        }}
      >
        {sections.map((section) => {
          const selected = section.id === value;
          return (
            <ListItemButton
              key={section.id}
              selected={selected}
              disabled={section.disabled}
              onClick={() => onChange(section.id)}
              sx={{ borderRadius: 2, width: { xs: 'auto', md: '100%' } }}
            >
              {section.icon && <ListItemIcon sx={{ minWidth: 32 }}>{section.icon}</ListItemIcon>}
              <ListItemText
                primary={section.label}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontWeight: selected ? 700 : 500 } },
                }}
              />
              {section.badge !== undefined && section.badge > 0 && (
                <Badge
                  badgeContent={section.badge}
                  color="primary"
                  max={999}
                  sx={{ mr: 1 }}
                  aria-label={`${section.badge}`}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>{children}</Box>
    </Box>
  );
}
