import {
  Close as CloseIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Public as PublicIcon,
  Language as NamespaceIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  alpha,
} from '@mui/material';

import { Permission } from '@/entities/asset';

import { borderRadius, typography, colors, spacing } from '@/shared/design-system/theme';
import { TypedChip } from '@/shared/ui';

import { PermissionsDialogProps } from '../../model';

interface PermissionItemProps {
  principal: string;
  type: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
  actions: string[];
}

const PermissionItem = ({ principal, type, actions }: PermissionItemProps) => {
  const getIcon = () => {
    switch(type) {
      case 'USER': return PersonIcon;
      case 'GROUP': return PeopleIcon;
      case 'NAMESPACE': return NamespaceIcon;
      case 'PUBLIC': return PublicIcon;
      default: return PersonIcon;
    }
  };
  const Icon = getIcon();
  const getColorConfig = () => {
    switch(type) {
      case 'USER': return colors.assetTypes.user;
      case 'GROUP': return colors.assetTypes.group;
      case 'NAMESPACE': return { main: '#9c27b0', light: '#e1bee7' }; // purple
      case 'PUBLIC': return { main: '#2196f3', light: '#bbdefb' }; // blue
      default: return colors.assetTypes.user;
    }
  };
  const colorConfig = getColorConfig();
  const principalName = principal.split('/').pop() || principal;
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: spacing.sm / 8 + 0.5,
        backgroundColor: 'background.paper',
        borderRadius: `${borderRadius.sm}px`,
        transition: 'all 0.2s',
        '&:hover': {
          backgroundColor: alpha(colorConfig.main, 0.05),
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: alpha(colorConfig.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 18, color: colorConfig.main }} />
        </Box>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="body2" fontWeight={typography.fontWeight.medium} noWrap>
            {principalName}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontSize: typography.fontSize.xs,
              display: 'block',
            }}
          >
            {actions.length} permission{actions.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const PermissionSection = ({ 
  type, 
  permissions 
}: { 
  type: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC'; 
  permissions: Permission[] 
}) => {
  const getIcon = () => {
    switch(type) {
      case 'USER': return PersonIcon;
      case 'GROUP': return PeopleIcon;
      case 'NAMESPACE': return NamespaceIcon;
      case 'PUBLIC': return PublicIcon;
      default: return PersonIcon;
    }
  };
  const Icon = getIcon();
  const getColorConfig = () => {
    switch(type) {
      case 'USER': return colors.assetTypes.user;
      case 'GROUP': return colors.assetTypes.group;
      case 'NAMESPACE': return { main: '#9c27b0', light: '#e1bee7' }; // purple
      case 'PUBLIC': return { main: '#2196f3', light: '#bbdefb' }; // blue
      default: return colors.assetTypes.user;
    }
  };
  const colorConfig = getColorConfig();
  const getLabel = () => {
    switch(type) {
      case 'USER': return 'Users';
      case 'GROUP': return 'Groups';
      case 'NAMESPACE': return 'Namespace';
      case 'PUBLIC': return 'Public';
      default: return 'Unknown';
    }
  };
  const label = getLabel();
  const hasPermissions = permissions.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{ 
        p: spacing.md / 8,
        border: `1px solid ${hasPermissions ? alpha(colorConfig.main, 0.2) : 'transparent'}`,
        backgroundColor: hasPermissions ? alpha(colorConfig.light, 0.3) : 'transparent',
        borderRadius: `${borderRadius.md}px`,
        opacity: hasPermissions ? 1 : 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: hasPermissions ? 1.5 : 0 }}>
        <Icon sx={{ fontSize: 20, color: hasPermissions ? colorConfig.main : 'text.disabled' }} />
        <Typography 
          variant="subtitle1" 
          fontWeight={typography.fontWeight.semibold}
          color={hasPermissions ? 'text.primary' : 'text.disabled'}
        >
          {label}
        </Typography>
        {hasPermissions && (
          <TypedChip 
            type={type}
            count={permissions.length}
            showIcon={false}
            size="small"
          />
        )}
      </Box>
      
      {hasPermissions && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {permissions.map((permission, idx) => {
            const actions = parseActions(permission);
            return (
              <PermissionItem
                key={idx}
                principal={permission.principal || 'Unknown'}
                type={type}
                actions={actions}
              />
            );
          })}
        </Box>
      )}
    </Paper>
  );
};

const parseActions = (permission: Permission): string[] => {
  if (Array.isArray(permission.actions)) {
    return permission.actions;
  }
  
  if (typeof permission.actions === 'string') {
    return (permission.actions as string).split(',').map(a => a.trim()).filter(Boolean);
  }
  
  const capitalizedActions = (permission as any).Actions;
  if (capitalizedActions) {
    if (Array.isArray(capitalizedActions)) {
      return capitalizedActions;
    }
    if (typeof capitalizedActions === 'string') {
      return capitalizedActions.split(',').map((a: string) => a.trim()).filter(Boolean);
    }
  }
  
  return [];
};

export default function PermissionsDialog({
  open,
  onClose,
  assetName,
  assetType,
  permissions = [],
}: PermissionsDialogProps) {
  const users = permissions.filter(p => p.principalType === 'USER');
  const groups = permissions.filter(p => p.principalType === 'GROUP');
  const namespacePerms = permissions.filter(p => p.principalType === 'NAMESPACE');
  const publicPerms = permissions.filter(p => p.principalType === 'PUBLIC');

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${borderRadius.lg}px`,
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={typography.fontWeight.semibold} gutterBottom>
              Permissions
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={assetType}
                size="small"
                sx={{ 
                  fontWeight: typography.fontWeight.medium,
                  textTransform: 'capitalize',
                }}
              />
              <Typography variant="body1" color="text.secondary">
                {assetName}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        {permissions.length === 0 ? (
          <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
          }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No permissions found
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {publicPerms.length > 0 && <PermissionSection type="PUBLIC" permissions={publicPerms} />}
            {namespacePerms.length > 0 && <PermissionSection type="NAMESPACE" permissions={namespacePerms} />}
            <PermissionSection type="GROUP" permissions={groups} />
            <PermissionSection type="USER" permissions={users} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}