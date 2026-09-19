import { Box } from '@mui/material';
import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { CommandPalette, CommandPaletteProvider } from '@/features/search';

import { config } from '@/shared/config';
import { tokens } from '@/shared/design-system';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const COLLAPSED_KEY = 'qsp.navigation.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Top bar, side navigation, and the page. The sidebar's collapsed state is a
 * per-browser convenience, so it lives in localStorage and nothing depends on
 * it being there.
 */
export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1');
      } catch {
        // Private mode or blocked storage: the toggle still works for this page.
      }
      return !prev;
    });
  }, []);

  const { topBarHeight } = tokens.layout;

  return (
    <CommandPaletteProvider>
      <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
        <CommandPalette />
        <TopBar environment={config.ENVIRONMENT} onToggleNavigation={toggle} />
        <Box
          sx={{
            position: 'fixed',
            top: topBarHeight,
            left: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.drawer,
          }}
        >
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
        </Box>
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            minWidth: 0,
            pt: `${topBarHeight + 24}px`,
            px: 3,
            pb: 3,
            ml: `${collapsed ? tokens.layout.sidebarCollapsedWidth : tokens.layout.sidebarWidth}px`,
            transition: theme.transitions.create('margin-left'),
          })}
        >
          <Outlet />
        </Box>
      </Box>
    </CommandPaletteProvider>
  );
}
