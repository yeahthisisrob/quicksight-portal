import {
  Close as CloseIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { useUserUnusedDatasets } from '../hooks/useUserUnusedDatasets';

interface UserUnusedDatasetsDialogProps {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string };
}

export function UserUnusedDatasetsDialog({
  open,
  onClose,
  user,
}: UserUnusedDatasetsDialogProps) {
  const {
    loading,
    error,
    datasets,
    selectedEmails,
    ccEmails,
    subject,
    setSubject,
    body,
    toggleEmail,
    addCcEmail,
    removeCcEmail,
    openMailto,
    selectedCount,
  } = useUserUnusedDatasets({ open, user });

  const [ccInput, setCcInput] = useState('');

  const handleAddCc = () => {
    if (ccInput.trim()) {
      addCcEmail(ccInput.trim());
      setCcInput('');
    }
  };

  const totalSpiceSize = datasets
    .filter((d) => d.importMode === 'SPICE' && d.sizeInBytes > 0)
    .reduce((sum, d) => sum + d.sizeInBytes, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <EmailIcon color="action" />
        Notify Unused Datasets
        <Chip label={user.name} size="small" variant="outlined" />
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {/* Summary Banner */}
        {!loading && (
          <Alert
            severity={datasets.length > 0 ? 'warning' : 'info'}
            variant="outlined"
          >
            <Typography variant="body2">
              {datasets.length > 0 ? (
                <>
                  Found <strong>{datasets.length}</strong> unused dataset
                  {datasets.length !== 1 ? 's' : ''} owned by{' '}
                  <strong>{user.name}</strong> with no dashboard or analysis references.
                </>
              ) : (
                error || 'No unused datasets found for this user.'
              )}
            </Typography>
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Dataset summary chips */}
        {!loading && datasets.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              icon={<StorageIcon sx={{ fontSize: 14 }} />}
              label={`${datasets.filter((d) => d.importMode === 'SPICE').length} SPICE`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: 12 }}
            />
            <Chip
              label={`${datasets.filter((d) => d.importMode === 'DIRECT_QUERY').length} Direct Query`}
              size="small"
              variant="outlined"
              sx={{ fontSize: 12 }}
            />
            {totalSpiceSize > 0 && (
              <Chip
                label={`SPICE: ${formatBytes(totalSpiceSize)}`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontSize: 12 }}
              />
            )}
          </Box>
        )}

        {/* Recipient */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            To
          </Typography>
          <List
            dense
            disablePadding
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <ListItemButton
              onClick={() => toggleEmail(user.email)}
              dense
              sx={{ py: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Checkbox
                  edge="start"
                  checked={selectedEmails.has(user.email)}
                  size="small"
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <PersonIcon sx={{ fontSize: 16, color: 'action.active', mr: 1 }} />
              <ListItemText
                primary={user.name}
                secondary={user.email}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>
          </List>
        </Box>

        {/* CC */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            CC
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Add CC email"
              value={ccInput}
              onChange={(e) => setCcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCc();
                }
              }}
              sx={{ flex: 1 }}
            />
            <Button size="small" onClick={handleAddCc} disabled={!ccInput.trim()}>
              Add
            </Button>
          </Box>
          {ccEmails.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {ccEmails.map((email) => (
                <Chip
                  key={email}
                  label={email}
                  size="small"
                  onDelete={() => removeCcEmail(email)}
                />
              ))}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Message */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2">Message</Typography>
          <TextField
            label="Subject"
            size="small"
            fullWidth
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <TextField
            label="Body"
            size="small"
            fullWidth
            multiline
            minRows={4}
            maxRows={8}
            value={body}
            InputProps={{ readOnly: true }}
            helperText="Auto-generated from lineage data"
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 12 } }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {selectedCount} recipient{selectedCount !== 1 ? 's' : ''} selected
          {ccEmails.length > 0 && `, ${ccEmails.length} CC`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            disabled={datasets.length === 0}
            onClick={() => {
              openMailto();
              onClose();
            }}
          >
            Open Email
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_GB) {
    return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}
