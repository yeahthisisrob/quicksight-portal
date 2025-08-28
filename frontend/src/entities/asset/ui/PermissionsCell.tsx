import { Box } from '@mui/material';

import { Permission } from '@/entities/asset';

import { TypedChip } from '@/shared/ui';

interface PermissionsCellProps {
  permissions?: Permission[];
  onClick?: () => void;
}

export default function PermissionsCell({ permissions = [], onClick }: PermissionsCellProps) {
  const userCount = permissions.filter(p => p.principalType === 'USER').length;
  const groupCount = permissions.filter(p => p.principalType === 'GROUP').length;
  const namespaceCount = permissions.filter(p => p.principalType === 'NAMESPACE').length;
  const publicCount = permissions.filter(p => p.principalType === 'PUBLIC').length;
  const totalCount = permissions.length;

  if (totalCount === 0) {
    return <TypedChip type="UNKNOWN" size="small" customLabel="No permissions" />;
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        gap: 0.5, 
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { opacity: 0.8 } : {}
      }}
      onClick={onClick}
    >
      {publicCount > 0 && (
        <TypedChip
          type="PUBLIC"
          customLabel={publicCount.toString()}
          size="small"
          variant="outlined"
        />
      )}
      {namespaceCount > 0 && (
        <TypedChip
          type="NAMESPACE"
          customLabel={namespaceCount.toString()}
          size="small"
          variant="outlined"
        />
      )}
      {userCount > 0 && (
        <TypedChip
          type="USER"
          customLabel={userCount.toString()}
          size="small"
          variant="outlined"
        />
      )}
      {groupCount > 0 && (
        <TypedChip
          type="GROUP"
          customLabel={groupCount.toString()}
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );
}