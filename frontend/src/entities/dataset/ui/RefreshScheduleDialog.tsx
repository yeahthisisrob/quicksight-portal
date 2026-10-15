/**
 * A dataset's refreshes: its schedules read live from QuickSight, each one
 * editable or removable, a new one added, and a SPICE refresh started now.
 */
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { getApiErrorMessage, refreshApi } from '@/shared/api';
import type { RefreshSchedule, RefreshScheduleInput } from '@/shared/api/modules/refresh';
import { EmptyState } from '@/shared/design-system';

interface RefreshScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  dataset: { id: string; name: string; importMode?: string };
}

const INTERVALS: Array<{ value: RefreshScheduleInput['interval']; label: string }> = [
  { value: 'MINUTE15', label: 'Every 15 minutes' },
  { value: 'MINUTE30', label: 'Every 30 minutes' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];
const DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;
const DAYS_IN_MONTH = 31;
const SKELETON_ROWS = 2;

const dayLabel = (day: string) => day.charAt(0) + day.slice(1).toLowerCase();
const intervalLabel = (interval: string) =>
  INTERVALS.find((i) => i.value === interval)?.label ?? interval;
const needsTime = (interval: string) => !['MINUTE15', 'MINUTE30', 'HOURLY'].includes(interval);

function describe(schedule: RefreshSchedule): string {
  const f = schedule.scheduleFrequency;
  const parts = [intervalLabel(f.interval)];
  if (f.refreshOnDay?.dayOfWeek) parts.push(`on ${dayLabel(f.refreshOnDay.dayOfWeek)}`);
  if (f.refreshOnDay?.dayOfMonth) parts.push(`on day ${f.refreshOnDay.dayOfMonth}`);
  if (f.timeOfTheDay) parts.push(`at ${f.timeOfTheDay}${f.timezone ? ` ${f.timezone}` : ''}`);
  return parts.join(' ');
}

function inputOf(schedule: RefreshSchedule): RefreshScheduleInput {
  const f = schedule.scheduleFrequency;
  return {
    interval: f.interval,
    refreshType: schedule.refreshType,
    ...(f.timeOfTheDay ? { timeOfTheDay: f.timeOfTheDay } : {}),
    ...(f.timezone ? { timezone: f.timezone } : {}),
    ...(f.refreshOnDay?.dayOfWeek ? { dayOfWeek: f.refreshOnDay.dayOfWeek } : {}),
    ...(f.refreshOnDay?.dayOfMonth ? { dayOfMonth: f.refreshOnDay.dayOfMonth } : {}),
  };
}

function blank(): RefreshScheduleInput {
  return {
    interval: 'DAILY',
    refreshType: 'FULL_REFRESH',
    timeOfTheDay: '06:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

/** The form for one schedule: new, or changing one. */
function ScheduleForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  value: RefreshScheduleInput;
  onChange: (next: RefreshScheduleInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  const set = (patch: Partial<RefreshScheduleInput>) => onChange({ ...value, ...patch });
  return (
    <Stack spacing={1.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="schedule-interval">How often</InputLabel>
          <Select
            labelId="schedule-interval"
            label="How often"
            value={value.interval}
            onChange={(e) => set({ interval: e.target.value as RefreshScheduleInput['interval'] })}
          >
            {INTERVALS.map((i) => (
              <MenuItem key={i.value} value={i.value}>
                {i.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="schedule-type">Refresh</InputLabel>
          <Select
            labelId="schedule-type"
            label="Refresh"
            value={value.refreshType}
            onChange={(e) =>
              set({ refreshType: e.target.value as RefreshScheduleInput['refreshType'] })
            }
          >
            <MenuItem value="FULL_REFRESH">Full</MenuItem>
            <MenuItem value="INCREMENTAL_REFRESH">Incremental</MenuItem>
          </Select>
        </FormControl>
        {value.interval === 'WEEKLY' && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="schedule-day">Day</InputLabel>
            <Select
              labelId="schedule-day"
              label="Day"
              value={value.dayOfWeek ?? 'MONDAY'}
              onChange={(e) =>
                set({ dayOfWeek: e.target.value as RefreshScheduleInput['dayOfWeek'] })
              }
            >
              {DAYS.map((d) => (
                <MenuItem key={d} value={d}>
                  {dayLabel(d)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {value.interval === 'MONTHLY' && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="schedule-dom">Day of month</InputLabel>
            <Select
              labelId="schedule-dom"
              label="Day of month"
              value={value.dayOfMonth ?? '1'}
              onChange={(e) => set({ dayOfMonth: String(e.target.value) })}
            >
              {Array.from({ length: DAYS_IN_MONTH }, (_, i) => String(i + 1)).map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {needsTime(value.interval) && (
          <>
            <TextField
              size="small"
              label="Time"
              type="time"
              value={value.timeOfTheDay ?? '06:00'}
              onChange={(e) => set({ timeOfTheDay: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 130 }}
            />
            <TextField
              size="small"
              label="Timezone"
              value={value.timezone ?? ''}
              onChange={(e) => set({ timezone: e.target.value })}
              sx={{ minWidth: 190 }}
            />
          </>
        )}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={saving}>
          {submitLabel}
        </Button>
      </Stack>
    </Stack>
  );
}

export function RefreshScheduleDialog({ open, onClose, dataset }: RefreshScheduleDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const schedules = useQuery({
    queryKey: ['refresh-schedules', dataset.id],
    queryFn: () => refreshApi.listSchedules(dataset.id),
    enabled: open,
  });
  const [editing, setEditing] = useState<{
    scheduleId?: string;
    value: RefreshScheduleInput;
  } | null>(null);
  const spice = dataset.importMode !== 'DIRECT_QUERY';

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['refresh-schedules', dataset.id] });

  const save = useMutation({
    mutationFn: ({ scheduleId, value }: { scheduleId?: string; value: RefreshScheduleInput }) =>
      scheduleId
        ? refreshApi.updateSchedule(dataset.id, scheduleId, value)
        : refreshApi.createSchedule(dataset.id, value),
    onSuccess: async (_, { scheduleId }) => {
      enqueueSnackbar(scheduleId ? 'Schedule changed' : 'Schedule added', { variant: 'success' });
      setEditing(null);
      await refresh();
    },
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'The schedule could not be saved'), {
        variant: 'error',
      }),
  });
  const remove = useMutation({
    mutationFn: (scheduleId: string) => refreshApi.deleteSchedule(dataset.id, scheduleId),
    onSuccess: async () => {
      enqueueSnackbar('Schedule removed', { variant: 'success' });
      await refresh();
    },
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'The schedule could not be removed'), {
        variant: 'error',
      }),
  });
  const refreshNow = useMutation({
    mutationFn: () => refreshApi.refreshNow(dataset.id),
    onSuccess: (ingestion) =>
      enqueueSnackbar(
        `Refreshing "${dataset.name}" (${ingestion.status.toLowerCase()}); see Ingestions for progress`,
        { variant: 'success' }
      ),
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'The refresh could not be started'), {
        variant: 'error',
      }),
  });

  const list = schedules.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ScheduleIcon color="primary" />
          <span>Refreshes</span>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {dataset.name}
          {spice ? '' : ' · direct query: nothing to refresh, but schedules may still exist'}
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
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {spice && (
              <Button
                variant="contained"
                startIcon={
                  refreshNow.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
                disabled={refreshNow.isPending}
                onClick={() => refreshNow.mutate()}
              >
                Refresh now
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              disabled={editing !== null}
              onClick={() => setEditing({ value: blank() })}
            >
              Add a schedule
            </Button>
          </Stack>
          {editing && !editing.scheduleId && (
            <ScheduleForm
              value={editing.value}
              onChange={(value) => setEditing({ value })}
              onSubmit={() => save.mutate(editing)}
              onCancel={() => setEditing(null)}
              saving={save.isPending}
              submitLabel="Add"
            />
          )}
          {schedules.isError ? (
            <Alert severity="error">
              {getApiErrorMessage(schedules.error, 'The refresh schedules could not be read')}
            </Alert>
          ) : schedules.isPending ? (
            <Stack spacing={1}>
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <Skeleton key={i} variant="rectangular" height={56} />
              ))}
            </Stack>
          ) : list.length === 0 ? (
            <EmptyState
              compact
              icon={<ScheduleIcon />}
              title="No schedules"
              description="This dataset is refreshed only when someone asks."
            />
          ) : (
            <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {list.map((schedule) =>
                editing?.scheduleId === schedule.scheduleId ? (
                  <Box key={schedule.scheduleId} sx={{ p: 1 }}>
                    <ScheduleForm
                      value={editing.value}
                      onChange={(value) => setEditing({ scheduleId: schedule.scheduleId, value })}
                      onSubmit={() => save.mutate(editing)}
                      onCancel={() => setEditing(null)}
                      saving={save.isPending}
                      submitLabel="Save"
                    />
                  </Box>
                ) : (
                  <ListItem
                    key={schedule.scheduleId}
                    divider
                    secondaryAction={
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          aria-label="Change schedule"
                          size="small"
                          disabled={editing !== null}
                          onClick={() =>
                            setEditing({
                              scheduleId: schedule.scheduleId,
                              value: inputOf(schedule),
                            })
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="Remove schedule"
                          size="small"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(schedule.scheduleId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {describe(schedule)}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={
                              schedule.refreshType === 'FULL_REFRESH' ? 'primary' : 'secondary'
                            }
                            label={schedule.refreshType === 'FULL_REFRESH' ? 'Full' : 'Incremental'}
                          />
                        </Stack>
                      }
                      secondary={
                        schedule.startAfterDateTime
                          ? `From ${format(new Date(schedule.startAfterDateTime), 'MMM d, yyyy HH:mm')}`
                          : undefined
                      }
                    />
                  </ListItem>
                )
              )}
            </List>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
