import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCommandPalette } from '@/features/search';

import { pal, tokens } from '@/shared/design-system';
import { useAuth } from '@/shared/lib/auth';
import { actionIcons, navigationIcons } from '@/shared/ui/icons';

export interface TopBarProps {
  /** Shown as a chip so nobody edits production thinking it is dev. */
  environment?: string;
  onToggleNavigation?: () => void;
}

const ENVIRONMENT_TONE: Record<string, 'default' | 'warning' | 'error'> = {
  production: 'error',
  prod: 'error',
  staging: 'warning',
};

/**
 * The dark bar across the top: product name, environment, colour scheme,
 * settings and the signed-in user. Navigation lives in the sidebar; this bar
 * is for things that are true everywhere.
 */
const SEARCH_BUTTON_WIDTH = 200;

export function TopBar({ environment, onToggleNavigation }: TopBarProps) {
  const navigate = useNavigate();
  const palette = useCommandPalette();
  const { user, logout } = useAuth();
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const dark = mode === 'dark';
  const SchemeIcon = dark ? navigationIcons.lightMode : navigationIcons.darkMode;
  const initial = user?.email?.[0]?.toUpperCase();

  return (
    <AppBar
      position="fixed"
      sx={(theme) => ({
        zIndex: theme.zIndex.drawer + 1,
        height: tokens.layout.topBarHeight,
        justifyContent: 'center',
      })}
    >
      <Toolbar
        variant="dense"
        disableGutters
        sx={{ px: 1.5, minHeight: tokens.layout.topBarHeight, gap: 1 }}
      >
        {onToggleNavigation && (
          <IconButton
            color="inherit"
            onClick={onToggleNavigation}
            aria-label="Toggle navigation"
            size="small"
            sx={{ mr: 0.5 }}
          >
            <navigationIcons.menu fontSize="small" />
          </IconButton>
        )}
        <Typography
          component="span"
          sx={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
        >
          QuickSight Assets Portal
        </Typography>
        {environment && (
          <Chip
            label={environment}
            size="small"
            color={ENVIRONMENT_TONE[environment.toLowerCase()] ?? 'default'}
            variant={ENVIRONMENT_TONE[environment.toLowerCase()] ? 'filled' : 'outlined'}
            sx={(theme) => ({
              ml: 1,
              textTransform: 'capitalize',
              ...(ENVIRONMENT_TONE[environment.toLowerCase()]
                ? {}
                : { color: pal(theme).text.inverse, borderColor: pal(theme).line.strong }),
            })}
          />
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Search everything (⌘K / Ctrl+K)">
          <Box
            component="button"
            type="button"
            aria-label="Search everything"
            onClick={palette.show}
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: SEARCH_BUTTON_WIDTH,
              mr: 1,
              px: 1.25,
              py: 0.5,
              borderRadius: `${theme.shape.borderRadius}px`,
              border: `1px solid ${pal(theme).line.strong}`,
              bgcolor: 'transparent',
              color: pal(theme).text.inverse,
              opacity: 0.85,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: theme.typography.body2.fontSize,
              '&:hover': { opacity: 1 },
            })}
          >
            <actionIcons.search fontSize="small" />
            <Box component="span" sx={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>
              Search
            </Box>
            <Box component="kbd" sx={{ fontFamily: 'inherit', opacity: 0.7 }}>
              ⌘K
            </Box>
          </Box>
        </Tooltip>

        <Tooltip title={dark ? 'Switch to light' : 'Switch to dark'}>
          <IconButton
            color="inherit"
            size="small"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setMode(dark ? 'light' : 'dark')}
          >
            <SchemeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton
            color="inherit"
            size="small"
            aria-label="Settings"
            onClick={() => navigate('/settings')}
          >
            <navigationIcons.settings fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={user?.email ?? 'Account'}>
          <IconButton
            size="small"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ ml: 0.5 }}
          >
            <Avatar
              sx={(theme) => ({
                width: 28,
                height: 28,
                fontSize: 13,
                fontWeight: 700,
                bgcolor: pal(theme).brand.primary,
                color: pal(theme).text.onBrand,
              })}
            >
              {initial ?? <navigationIcons.account fontSize="small" />}
            </Avatar>
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {user?.email?.split('@')[0] ?? 'Signed in'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={() => {
              setAnchor(null);
              void logout();
            }}
          >
            <ListItemIcon>
              <navigationIcons.logout fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
