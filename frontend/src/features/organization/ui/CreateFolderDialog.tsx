/**
 * A new folder: a name, and the folder to put it under (or the top).
 */
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { useFolders } from '@/entities/folder';

import { assetsApi, foldersApi, getApiErrorMessage } from '@/shared/api';

const ALL_FOLDERS = 1000;

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (folder: { folderId: string; name: string }) => void;
}

export function CreateFolderDialog({ open, onClose, onCreated }: CreateFolderDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { invalidateFolders } = useFolders();
  const [name, setName] = useState('');
  const [parent, setParent] = useState<{ id: string; path: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const folders = useQuery({
    queryKey: ['folders-for-picker'],
    queryFn: () => assetsApi.getFoldersPaginated({ page: 1, pageSize: ALL_FOLDERS }),
    enabled: open,
  });

  const options = (folders.data?.folders ?? []).map(
    (f: { id: string; name: string; path?: string }) => ({
      id: f.id,
      path: f.path ?? f.name,
    })
  );

  const close = () => {
    if (saving) return;
    setName('');
    setParent(null);
    onClose();
  };

  const create = async () => {
    setSaving(true);
    try {
      const created = await foldersApi.create({
        name: name.trim(),
        ...(parent ? { parentFolderId: parent.id } : {}),
      });
      enqueueSnackbar(`Created folder "${created.name}"`, { variant: 'success' });
      await invalidateFolders();
      onCreated(created);
      setName('');
      setParent(null);
    } catch (error) {
      enqueueSnackbar(getApiErrorMessage(error, 'The folder could not be created'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>New folder</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            fullWidth
            disabled={saving}
            slotProps={{ htmlInput: { 'aria-label': 'Folder name' } }}
          />
          <Autocomplete
            options={options}
            value={parent}
            onChange={(_, value) => setParent(value)}
            getOptionLabel={(o) => o.path}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            disabled={saving}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Inside"
                helperText="Leave empty to create it at the top."
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void create()} disabled={saving || !name.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
