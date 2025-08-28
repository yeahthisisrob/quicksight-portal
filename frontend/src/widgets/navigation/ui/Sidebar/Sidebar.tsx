import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Avatar,
  Typography,
  alpha,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/app/providers';

import { colors, spacing } from '@/shared/design-system/theme';
import { navigationIcons } from '@/shared/ui/icons';

import { navigationConfig } from './navigationConfig';

export const DRAWER_WIDTH = 240;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: spacing.md / 8 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            background: `linear-gradient(135deg, ${colors.assetTypes.dashboard.main} 0%, ${colors.assetTypes.analysis.main} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          QuickSight Portal
        </Typography>
      </Box>
      <List sx={{ pt: 0, flexGrow: 1 }}>
        {navigationConfig.map((section) => (
          <div key={section.title}>
            {section.divider && <Divider sx={{ my: spacing.sm / 8 }} />}
            {section.items.map((item) => {
              const Icon = navigationIcons[item.icon];
              const isActive = location.pathname === item.path;
              
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    selected={isActive}
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      borderRadius: `${spacing.sm / 8}px`,
                      mx: spacing.sm / 8,
                      my: spacing.xs / 16,
                      '&.Mui-selected': {
                        backgroundColor: colors.assetTypes[item.colorKey || 'dashboard'].light,
                        color: colors.assetTypes[item.colorKey || 'dashboard'].dark,
                        '& .MuiListItemIcon-root': {
                          color: colors.assetTypes[item.colorKey || 'dashboard'].main,
                        },
                        '&:hover': {
                          backgroundColor: colors.assetTypes[item.colorKey || 'dashboard'].light,
                        },
                      },
                      '&:hover': {
                        backgroundColor: `${colors.assetTypes[item.colorKey || 'dashboard'].light}33`,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </div>
        ))}
      </List>
      
      {/* User section at bottom */}
      <Box>
        <Divider sx={{ mx: spacing.sm / 8, mb: spacing.sm / 8 }} />
        <Box
          sx={{
            p: spacing.md / 8,
            mx: spacing.sm / 8,
            mb: spacing.sm / 8,
            borderRadius: `${spacing.sm / 8}px`,
            background: `linear-gradient(135deg, ${alpha(colors.primary.light, 0.05)} 0%, ${alpha(colors.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: spacing.sm / 8 }}>
            <Avatar 
              sx={{ 
                width: 36, 
                height: 36, 
                mr: spacing.sm / 8,
                background: `linear-gradient(135deg, ${colors.assetTypes.dashboard.main} 0%, ${colors.assetTypes.analysis.main} 100%)`,
                border: `2px solid ${alpha(colors.neutral[100], 0.8)}`,
              }}
            >
              {user?.email?.[0]?.toUpperCase() || <navigationIcons.user />}
            </Avatar>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  color: colors.neutral[800],
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email?.split('@')[0] || 'User'}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: colors.neutral[600],
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {user?.email}
              </Typography>
            </Box>
          </Box>
          
          <ListItemButton
            onClick={logout}
            sx={{
              borderRadius: `${spacing.xs / 16}px`,
              py: spacing.xs / 16,
              color: colors.neutral[700],
              '&:hover': {
                backgroundColor: alpha(colors.status.error, 0.08),
                color: colors.status.error,
                '& .MuiListItemIcon-root': {
                  color: colors.status.error,
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <navigationIcons.logout />
            </ListItemIcon>
            <ListItemText 
              primary="Logout" 
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
          </ListItemButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        '& .MuiDrawer-paper': { 
          boxSizing: 'border-box', 
          width: DRAWER_WIDTH,
          borderRight: `1px solid ${colors.neutral[200]}`,
          background: `linear-gradient(to bottom, ${alpha(colors.neutral[50], 0.8)}, ${alpha(colors.neutral[50], 0.95)})`,
        },
      }}
    >
      {sidebarContent}
    </Drawer>
  );
}