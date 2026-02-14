import {
  Close as CloseIcon,
  Email as EmailIcon,
  ExpandLess,
  ExpandMore,
  PersonAdd as PersonAddIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
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

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function initials(name: string): string {
  const parts = name.replace(/[._@]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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

        {/* Selected Recipients as Chips */}
        {selectedCount > 0 && recipients && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              To ({selectedCount})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {/* Show selected user chips */}
              {recipients.users
                .filter((u) => selectedEmails.has(u.email))
                .map((u) => (
                  <Chip
                    key={u.email}
                    avatar={
                      <Avatar sx={{ bgcolor: stringToColor(u.userName), width: 24, height: 24, fontSize: 11 }}>
                        {initials(u.userName)}
                      </Avatar>
                    }
                    label={u.userName}
                    size="small"
                    onDelete={() => toggleEmail(u.email)}
                    sx={{ maxWidth: 200 }}
                  />
                ))}
              {/* Show selected group member chips */}
              {recipients.groups.flatMap((g) =>
                g.members
                  .filter((m) => selectedEmails.has(m.email))
                  // Don't duplicate if already shown as a direct user
                  .filter((m) => !recipients.users.some((u) => u.email === m.email && selectedEmails.has(u.email)))
                  .map((m) => (
                    <Chip
                      key={`${g.groupName}-${m.email}`}
                      avatar={
                        <Avatar sx={{ bgcolor: stringToColor(m.userName), width: 24, height: 24, fontSize: 11 }}>
                          {initials(m.userName)}
                        </Avatar>
                      }
                      label={m.userName}
                      size="small"
                      onDelete={() => toggleEmail(m.email)}
                      sx={{ maxWidth: 200 }}
                    />
                  ))
              )}
            </Box>
          </Box>
        )}

        {/* Recipient Picker */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="subtitle2">
              Add Recipients
            </Typography>
            {!loading && allCount > 0 && (
              <Button
                size="small"
                onClick={allSelected ? deselectAll : selectAll}
                sx={{ textTransform: 'none', minWidth: 0 }}
              >
                {allSelected ? 'Remove All' : 'Add All'}
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
                {error || 'No recipients resolved. You can still compose and send the email manually.'}
              </Typography>
            </Alert>
          ) : (
            <Box
              sx={{
                maxHeight: 260,
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
                    selected={selected}
                    dense
                    sx={{
                      py: 0.5,
                      '&.Mui-selected': {
                        bgcolor: 'action.selected',
                      },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          fontSize: 12,
                          bgcolor: stringToColor(user.userName),
                        }}
                      >
                        {initials(user.userName)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.userName}
                      secondary={user.email}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <Tooltip title={selected ? 'Remove' : 'Add to recipients'}>
                      <IconButton size="small" edge="end" sx={{ opacity: selected ? 1 : 0.4 }}>
                        <PersonAddIcon fontSize="small" color={selected ? 'primary' : 'action'} />
                      </IconButton>
                    </Tooltip>
                  </ListItemButton>
                );
              })}

              {/* Groups */}
              {recipients.groups.length > 0 && recipients.users.length > 0 && (
                <Divider />
              )}
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
                      sx={{ py: 0.5 }}
                    >
                      <ListItemAvatar sx={{ minWidth: 36 }}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            fontSize: 11,
                            bgcolor: stringToColor(group.groupName),
                          }}
                        >
                          {initials(group.groupName)}
                        </Avatar>
                      </ListItemAvatar>
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
                              color={allGroupSelected ? 'primary' : someGroupSelected ? 'default' : 'default'}
                              variant={someGroupSelected ? 'filled' : 'outlined'}
                              sx={{ height: 20, fontSize: 11 }}
                            />
                          </Box>
                        }
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(group.groupName);
                        }}
                        sx={{ textTransform: 'none', minWidth: 0, mr: 0.5 }}
                      >
                        {allGroupSelected ? 'Remove' : 'Add All'}
                      </Button>
                      {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </ListItemButton>

                    <Collapse in={isExpanded} timeout="auto">
                      {group.members.map((member) => {
                        const selected = selectedEmails.has(member.email);
                        return (
                          <ListItemButton
                            key={member.email}
                            onClick={() => toggleEmail(member.email)}
                            selected={selected}
                            dense
                            sx={{
                              pl: 6,
                              py: 0.25,
                              '&.Mui-selected': {
                                bgcolor: 'action.selected',
                              },
                            }}
                          >
                            <ListItemAvatar sx={{ minWidth: 32 }}>
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  fontSize: 11,
                                  bgcolor: stringToColor(member.userName),
                                }}
                              >
                                {initials(member.userName)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={member.userName}
                              secondary={member.email}
                              primaryTypographyProps={{ variant: 'body2', fontSize: 13 }}
                              secondaryTypographyProps={{ variant: 'caption', fontSize: 11 }}
                            />
                            <Tooltip title={selected ? 'Remove' : 'Add to recipients'}>
                              <IconButton size="small" edge="end" sx={{ opacity: selected ? 1 : 0.3 }}>
                                <PersonAddIcon
                                  sx={{ fontSize: 16 }}
                                  color={selected ? 'primary' : 'action'}
                                />
                              </IconButton>
                            </Tooltip>
                          </ListItemButton>
                        );
                      })}
                    </Collapse>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Message Composer */}
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
