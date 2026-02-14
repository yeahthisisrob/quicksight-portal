import {
  Close as CloseIcon,
  Email as EmailIcon,
  ExpandLess,
  ExpandMore,
  Group as GroupIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
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

import { useInactivityMailto } from '../hooks/useInactivityMailto';

interface InactivityMailtoDialogProps {
  open: boolean;
  onClose: () => void;
  asset: {
    id: string;
    name: string;
    type: 'dashboard' | 'analysis';
    lastViewed?: string | null;
    activityCount?: number;
  };
}

export function InactivityMailtoDialog({ open, onClose, asset }: InactivityMailtoDialogProps) {
  const {
    loading,
    error,
    recipients,
    selectedEmails,
    expandedGroups,
    subject,
    setSubject,
    body,
    inactivityText,
    toggleEmail,
    toggleGroup,
    toggleExpandGroup,
    selectAll,
    deselectAll,
    openMailto,
    selectedCount,
    groupBreakdown,
    filteredActivity,
    excludedGroups,
    toggleExcludeGroup,
    hasActivityData,
  } = useInactivityMailto({ open, asset });

  const typeLabel = asset.type === 'dashboard' ? 'Dashboard' : 'Analysis';
  const allCount = recipients
    ? new Set([
        ...recipients.users.map((u) => u.email),
        ...recipients.groups.flatMap((g) => g.members.map((m) => m.email)),
      ]).size
    : 0;
  const allSelected = allCount > 0 && selectedCount === allCount;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <EmailIcon color="action" />
        Notify Inactive
        <Chip label={typeLabel} size="small" variant="outlined" />
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {/* Inactivity Banner */}
        <Alert severity="warning" variant="outlined">
          <Typography variant="body2">
            <strong>{asset.name}</strong> {inactivityText}.
            {hasActivityData && (
              <>
                {' '}
                <strong>{filteredActivity.totalViews}</strong> view{filteredActivity.totalViews !== 1 ? 's' : ''} by{' '}
                <strong>{filteredActivity.uniqueViewers}</strong> user{filteredActivity.uniqueViewers !== 1 ? 's' : ''}
                {excludedGroups.size > 0 && (
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}(filtered)
                  </Typography>
                )}
              </>
            )}
          </Typography>
        </Alert>

        {/* Activity Breakdown by Group */}
        {hasActivityData && groupBreakdown.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <VisibilityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                Activity by group — click to exclude
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {groupBreakdown.map((group) => {
                const isExcluded = excludedGroups.has(group.groupName);
                return (
                  <Chip
                    key={group.groupName}
                    label={`${group.groupName} · ${group.viewCount}`}
                    size="small"
                    variant={isExcluded ? 'outlined' : 'filled'}
                    color={isExcluded ? 'default' : 'primary'}
                    onClick={() => toggleExcludeGroup(group.groupName)}
                    sx={{
                      opacity: isExcluded ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      textDecoration: isExcluded ? 'line-through' : 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Recipients */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2">
              Recipients {selectedCount > 0 && `(${selectedCount})`}
            </Typography>
            {!loading && allCount > 0 && (
              <Button
                size="small"
                onClick={allSelected ? deselectAll : selectAll}
                sx={{ textTransform: 'none', minWidth: 0 }}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !recipients || allCount === 0 ? (
            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              <Typography variant="body2">
                {error || 'No recipients resolved. You can still send the email manually.'}
              </Typography>
            </Alert>
          ) : (
            <List
              dense
              disablePadding
              sx={{
                maxHeight: 280,
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {/* Direct Users */}
              {recipients.users.map((user) => {
                const selected = selectedEmails.has(user.email);
                return (
                  <ListItemButton
                    key={user.email}
                    onClick={() => toggleEmail(user.email)}
                    dense
                    sx={{ py: 0.25 }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Checkbox edge="start" checked={selected} size="small" tabIndex={-1} disableRipple />
                    </ListItemIcon>
                    <PersonIcon sx={{ fontSize: 16, color: 'action.active', mr: 1 }} />
                    <ListItemText
                      primary={user.userName}
                      secondary={user.email}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                );
              })}

              {/* Groups */}
              {recipients.groups.length > 0 && recipients.users.length > 0 && <Divider />}
              {recipients.groups.map((group) => {
                const groupEmails = group.members.map((m) => m.email);
                const allGroupSelected = groupEmails.length > 0 && groupEmails.every((e) => selectedEmails.has(e));
                const someGroupSelected = groupEmails.some((e) => selectedEmails.has(e));
                const isExpanded = expandedGroups.has(group.groupName);
                const selectedInGroup = groupEmails.filter((e) => selectedEmails.has(e)).length;

                return (
                  <Box key={group.groupName}>
                    <ListItemButton
                      onClick={() => toggleExpandGroup(group.groupName)}
                      dense
                      sx={{ py: 0.25 }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Checkbox
                          edge="start"
                          checked={allGroupSelected}
                          indeterminate={someGroupSelected && !allGroupSelected}
                          size="small"
                          tabIndex={-1}
                          disableRipple
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroup(group.groupName);
                          }}
                        />
                      </ListItemIcon>
                      <GroupIcon sx={{ fontSize: 16, color: 'action.active', mr: 1 }} />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <span>{group.groupName}</span>
                            <Chip
                              label={
                                someGroupSelected
                                  ? `${selectedInGroup}/${group.members.length}`
                                  : group.members.length
                              }
                              size="small"
                              variant={someGroupSelected ? 'filled' : 'outlined'}
                              color={someGroupSelected ? 'primary' : 'default'}
                              sx={{ height: 18, fontSize: 11 }}
                            />
                          </Box>
                        }
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                      {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </ListItemButton>

                    <Collapse in={isExpanded} timeout="auto">
                      {group.members.map((member) => {
                        const selected = selectedEmails.has(member.email);
                        return (
                          <ListItemButton
                            key={member.email}
                            onClick={() => toggleEmail(member.email)}
                            dense
                            sx={{ pl: 7, py: 0.125 }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <Checkbox edge="start" checked={selected} size="small" tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText
                              primary={member.userName}
                              secondary={member.email}
                              primaryTypographyProps={{ variant: 'body2', fontSize: 13 }}
                              secondaryTypographyProps={{ variant: 'caption', fontSize: 11 }}
                            />
                          </ListItemButton>
                        );
                      })}
                    </Collapse>
                  </Box>
                );
              })}
            </List>
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
            helperText="Auto-generated from activity data and group filters"
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 12 } }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {selectedCount} recipient{selectedCount !== 1 ? 's' : ''} selected
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
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
