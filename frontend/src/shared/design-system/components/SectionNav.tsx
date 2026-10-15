import { Badge, Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import type { ReactNode } from 'react';

interface SectionNavItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  /** A count shown beside the label (unsaved changes, items needing attention). */
  badge?: number;
  disabled?: boolean;
  /** Sections under this one, listed indented; choosing the parent opens the first. */
  children?: SectionNavItem<T>[];
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
 * wraps above the content. A section may hold sections of its own (the
 * Studio's editor, templates, playbooks and knowledge under Author), listed
 * indented beneath it. The open section is the page's current URL, so sync
 * `value` with a query parameter to make it deep-linkable.
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
        {sections.flatMap((section) => {
          const nested = section.children ?? [];
          const open = section.id === value || nested.some((c) => c.id === value);
          const row = (item: SectionNavItem<T>, depth: number, selected: boolean) => (
            <ListItemButton
              key={item.id}
              selected={selected}
              disabled={item.disabled}
              onClick={() => onChange(item.children?.[0]?.id ?? item.id)}
              sx={{
                borderRadius: 2,
                width: { xs: 'auto', md: '100%' },
                pl: { md: 2 + depth * 2.5 },
              }}
            >
              {item.icon && <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>}
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    variant: 'body2',
                    sx: { fontWeight: selected || (depth === 0 && open) ? 700 : 500 },
                  },
                }}
              />
              {item.badge !== undefined && item.badge > 0 && (
                <Badge
                  badgeContent={item.badge}
                  color="primary"
                  max={999}
                  sx={{ mr: 1 }}
                  aria-label={`${item.badge}`}
                />
              )}
            </ListItemButton>
          );
          return [
            row(section, 0, section.id === value),
            ...nested.map((child) => row(child, 1, child.id === value)),
          ];
        })}
      </List>
      <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>{children}</Box>
    </Box>
  );
}
