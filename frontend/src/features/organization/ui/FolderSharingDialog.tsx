/**
 * Who can see or work in a folder: each user and group with its role, live
 * from QuickSight; add one with a role, or take one out.
 */
import { Close as CloseIcon, Delete as RemoveIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { assetsApi, foldersApi, getApiErrorMessage } from '@/shared/api';
import type { FolderPermission, FolderRole, PrincipalType } from '@/shared/api/modules/folders';
import { EmptyState } from '@/shared/design-system';
import { TypedChip } from '@/shared/ui';

interface FolderSharingDialogProps {
  open: boolean;
  onClose: () => void;
  folder: { id: string; name: string };
}

const ROLES: Array<{ value: FolderRole; label: string; hint: string }> = [
  { value: 'VIEWER', label: 'Viewer', hint: 'Sees the folder and what it holds' },
  { value: 'AUTHOR', label: 'Author', hint: 'Can also create analyses and dashboards in it' },
  { value: 'ADMIN', label: 'Admin', hint: 'Can also share it and delete it' },
];
const PAGE = 1000;
const SKELETON_ROWS = 3;

interface Principal {
  id: string;
  label: string;
  type: PrincipalType;
}

function usePrincipals(enabled: boolean) {
  return useQuery({
    queryKey: ['folder-sharing-principals'],
    queryFn: async (): Promise<Principal[]> => {
      const [users, groups] = await Promise.all([
        assetsApi.getUsersPaginated({ page: 1, pageSize: PAGE }),
        assetsApi.getGroupsPaginated({ page: 1, pageSize: PAGE }),
      ]);
      return [
        ...(groups.groups ?? []).map((g: any) => ({
          id: g.name ?? g.id,
          label: g.name ?? g.id,
          type: 'GROUP' as const,
        })),
        ...(users.users ?? []).map((u: any) => ({
          id: u.name ?? u.id,
          label: u.email ? `${u.name ?? u.id} (${u.email})` : (u.name ?? u.id),
          type: 'USER' as const,
        })),
      ];
    },
    enabled,
  });
}

export function FolderSharingDialog({ open, onClose, folder }: FolderSharingDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const permissions = useQuery({
    queryKey: ['folder-permissions', folder.id],
    queryFn: () => foldersApi.getPermissions(folder.id),
    enabled: open,
  });
  const principals = usePrincipals(open);
  const [picked, setPicked] = useState<Principal | null>(null);
  const [role, setRole] = useState<FolderRole>('VIEWER');

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['folder-permissions', folder.id] });

  const add = useMutation({
    mutationFn: (p: Principal) => foldersApi.addPrincipal(folder.id, p.id, p.type, role),
    onSuccess: async (_, p) => {
      enqueueSnackbar(
        `${p.label} can now ${role === 'VIEWER' ? 'see' : 'work in'} "${folder.name}"`,
        {
          variant: 'success',
        }
      );
      setPicked(null);
      await refresh();
    },
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'The folder could not be shared'), {
        variant: 'error',
      }),
  });
  const remove = useMutation({
    mutationFn: (p: FolderPermission) =>
      foldersApi.removePrincipal(folder.id, p.name.split('/').pop() ?? p.name, p.type),
    onSuccess: async (_, p) => {
      enqueueSnackbar(`${p.name} no longer has access to "${folder.name}"`, { variant: 'success' });
      await refresh();
    },
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'The access could not be removed'), {
        variant: 'error',
      }),
  });

  const current = permissions.data ?? [];
  const onFolder = new Set(current.map((p) => `${p.type}:${p.name.split('/').pop()}`));
  const choices = (principals.data ?? []).filter((p) => !onFolder.has(`${p.type}:${p.id}`));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        Share "{folder.name}"
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          Who can see or work in this folder, live from QuickSight.
        </Typography>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={choices}
              value={picked}
              onChange={(_, value) => setPicked(value)}
              loading={principals.isPending}
              groupBy={(o) => (o.type === 'GROUP' ? 'Groups' : 'People')}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id && a.type === b.type}
              renderInput={(params) => (
                <TextField {...params} label="Add a person or group" size="small" />
              )}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="folder-role">Role</InputLabel>
              <Select
                labelId="folder-role"
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as FolderRole)}
              >
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disabled={!picked || add.isPending}
              onClick={() => picked && add.mutate(picked)}
            >
              Add
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {ROLES.find((r) => r.value === role)?.hint}
          </Typography>
          {permissions.isError ? (
            <Alert severity="error">
              {getApiErrorMessage(permissions.error, 'The folder permissions could not be read')}
            </Alert>
          ) : permissions.isPending ? (
            <Stack spacing={1}>
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <Skeleton key={i} variant="text" />
              ))}
            </Stack>
          ) : current.length === 0 ? (
            <EmptyState
              compact
              title="Nobody yet"
              description="Only admins can see this folder until it is shared."
            />
          ) : (
            <List dense disablePadding>
              {current.map((p) => (
                <ListItem
                  key={p.principal}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={`Remove ${p.name}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(p)}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <TypedChip type={p.type} size="small" showIcon={false} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {p.name.split('/').pop()}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={ROLES.find((r) => r.value === p.role)?.label ?? p.role}
                        />
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
