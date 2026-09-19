import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { pal, tokens } from '@/shared/design-system';
import { navigationIcons } from '@/shared/ui/icons';

import {
  isNavigationItemActive,
  type NavigationItem,
  navigationConfig,
  utilityNavigation,
} from './navigationConfig';

export const DRAWER_WIDTH = tokens.layout.sidebarWidth;
export const DRAWER_COLLAPSED_WIDTH = tokens.layout.sidebarCollapsedWidth;

export interface SidebarProps {
  /** Icons only. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Override the active route (stories, tests). Defaults to the router location. */
  currentPath?: string;
}

function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavigationItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = navigationIcons[item.icon];
  const button = (
    <ListItemButton
      selected={active}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={(theme) => {
        const accent = item.colorKey ? pal(theme).asset[item.colorKey] : null;
        return {
          mx: 1,
          my: 0.25,
          minHeight: 36,
          px: collapsed ? 1.5 : 1.5,
          justifyContent: collapsed ? 'center' : 'flex-start',
          position: 'relative',
          color: pal(theme).text.primary,
          '& .MuiListItemIcon-root': {
            minWidth: collapsed ? 0 : 32,
            color: pal(theme).text.secondary,
          },
          '&:hover': { backgroundColor: pal(theme).surface.hover },
          // The active indicator: a 3px bar on the left edge, in the brand
          // blue or, for asset pages, that asset's colour.
          '&.Mui-selected': {
            backgroundColor: accent ? accent.subtle : pal(theme).brand.subtle,
            color: accent ? accent.strong : pal(theme).brand.primary,
            '& .MuiListItemIcon-root': { color: accent ? accent.main : pal(theme).brand.primary },
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -8,
              top: 6,
              bottom: 6,
              width: 3,
              borderRadius: 3,
              backgroundColor: accent ? accent.main : pal(theme).brand.primary,
            },
          },
        };
      }}
    >
      <ListItemIcon>
        <Icon fontSize="small" />
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={item.text}
          slotProps={{ primary: { sx: { fontWeight: active ? 700 : 500, fontSize: 14 } } }}
        />
      )}
    </ListItemButton>
  );

  return (
    <ListItem disablePadding>
      {collapsed ? (
        <Tooltip title={item.text} placement="right" arrow>
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </ListItem>
  );
}

/**
 * The side navigation: sections with small headers, a blue (or asset-coloured)
 * active indicator, and a collapsed icon-only mode. Keyboard users tab through
 * the items; the current page is announced through aria-current.
 */
export function Sidebar({ collapsed = false, onToggleCollapsed, currentPath }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = currentPath ?? location.pathname;
  const ToggleIcon = collapsed ? navigationIcons.expand : navigationIcons.collapse;

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={(theme) => ({
        width: collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: pal(theme).surface.container,
        borderRight: `1px solid ${pal(theme).line.divider}`,
        transition: theme.transitions.create('width'),
        overflowX: 'hidden',
      })}
    >
      <List sx={{ pt: 1, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navigationConfig.map((section, index) => (
          // Fragment, not a div: a direct child of <List> (a <ul>) must be <li>.
          // The first section has no title, so the index backs the key.
          <Fragment key={section.title ?? `section-${index}`}>
            {index > 0 && <Divider sx={{ my: 1, mx: 2 }} />}
            {section.title && !collapsed && (
              <Typography
                component="li"
                variant="overline"
                sx={(theme) => ({
                  display: 'block',
                  px: 2.5,
                  pt: 0.5,
                  pb: 0.5,
                  color: pal(theme).text.muted,
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                })}
              >
                {section.title}
              </Typography>
            )}
            {section.items.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                active={isNavigationItemActive(item, pathname)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </Fragment>
        ))}
      </List>

      <Divider sx={{ mx: 2 }} />
      <List sx={{ py: 1 }}>
        {utilityNavigation.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            active={isNavigationItemActive(item, pathname)}
            onClick={() => navigate(item.path)}
          />
        ))}
        {onToggleCollapsed && (
          <ListItem disablePadding>
            <Tooltip
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              placement="right"
            >
              <ListItemButton
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                aria-expanded={!collapsed}
                sx={(theme) => ({
                  mx: 1,
                  minHeight: 36,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  color: pal(theme).text.secondary,
                  '& .MuiListItemIcon-root': { minWidth: collapsed ? 0 : 32, color: 'inherit' },
                })}
              >
                <ListItemIcon>
                  <ToggleIcon fontSize="small" />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary="Collapse"
                    slotProps={{ primary: { sx: { fontSize: 14 } } }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}
      </List>
    </Box>
  );
}
