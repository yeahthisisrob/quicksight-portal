import { Close as CloseIcon, Schedule as ScheduleIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import { format } from 'date-fns';

interface RefreshSchedule {
  scheduleId: string;
  scheduleFrequency: {
    interval: 'MINUTE15' | 'MINUTE30' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    refreshOnDay?: {
      dayOfWeek?: 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
      dayOfMonth?: string;
    };
    timeOfTheDay?: string;
    timezone?: string;
  };
  startAfterDateTime?: string;
  refreshType: 'INCREMENTAL_REFRESH' | 'FULL_REFRESH';
  arn: string;
}

interface RefreshScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  datasetName: string;
  refreshSchedules?: RefreshSchedule[];
  dataSetRefreshProperties?: any;
}

const formatInterval = (interval: string): string => {
  const intervalMap: Record<string, string> = {
    MINUTE15: 'Every 15 minutes',
    MINUTE30: 'Every 30 minutes',
    HOURLY: 'Hourly',
    DAILY: 'Daily',
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
  };
  return intervalMap[interval] || interval;
};

const formatDayOfWeek = (dayOfWeek?: string): string => {
  if (!dayOfWeek) return '';
  const dayMap: Record<string, string> = {
    SUNDAY: 'Sunday',
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
  };
  return dayMap[dayOfWeek] || dayOfWeek;
};

export function RefreshScheduleDialog({
  open,
  onClose,
  datasetName,
  refreshSchedules = [],
  dataSetRefreshProperties,
}: RefreshScheduleDialogProps) {
  // Validate and filter schedules
  // Handle both camelCase and PascalCase properties
  const validSchedules = Array.isArray(refreshSchedules)
    ? refreshSchedules.filter((s: any) => s && typeof s === 'object' && 
        ((s.scheduleFrequency || s['ScheduleFrequency']) && (s.refreshType || s['RefreshType'])))
    : [];
  
  const hasSchedules = validSchedules.length > 0;
  const hasProperties = dataSetRefreshProperties && Object.keys(dataSetRefreshProperties).length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon color="primary" />
          <Typography variant="h6" component="div">
            Refresh Schedules
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Dataset: {datasetName}
        </Typography>
        
        {!hasSchedules && !hasProperties && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ScheduleIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No refresh schedules configured for this dataset
            </Typography>
          </Box>
        )}

        {hasSchedules && (
          <Box sx={{ mb: hasProperties ? 3 : 0 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RefreshIcon fontSize="small" />
              Refresh Schedules ({validSchedules.length})
            </Typography>
            
            <List sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              {validSchedules.map((schedule, index) => (
                <div key={schedule.scheduleId}>
                  <ListItem sx={{ py: 2 }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {formatInterval(
                              ((schedule as any).scheduleFrequency || (schedule as any)['ScheduleFrequency'])?.interval ||
                              ((schedule as any).scheduleFrequency || (schedule as any)['ScheduleFrequency'])?.['Interval'] ||
                              'UNKNOWN'
                            )}
                          </Typography>
                          <Chip
                            label={((schedule as any).refreshType || (schedule as any)['RefreshType']) === 'FULL_REFRESH' ? 'Full' : 'Incremental'}
                            size="small"
                            variant="outlined"
                            color={((schedule as any).refreshType || (schedule as any)['RefreshType']) === 'FULL_REFRESH' ? 'primary' : 'secondary'}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {(() => {
                            const sched = schedule as any;
                            const freq = sched.scheduleFrequency || sched['ScheduleFrequency'];
                            const timeOfDay = freq?.timeOfTheDay || freq?.['TimeOfTheDay'];
                            const timezone = freq?.timezone || freq?.['Timezone'];
                            const refreshOnDay = freq?.refreshOnDay || freq?.['RefreshOnDay'];
                            const dayOfWeek = refreshOnDay?.dayOfWeek || refreshOnDay?.['DayOfWeek'];
                            const dayOfMonth = refreshOnDay?.dayOfMonth || refreshOnDay?.['DayOfMonth'];
                            const startAfter = sched.startAfterDateTime || sched['StartAfterDateTime'];
                            const schedId = sched.scheduleId || sched['ScheduleId'];
                            
                            return (
                              <>
                                {timeOfDay && (
                                  <Typography variant="body2" color="text.secondary">
                                    Time: {timeOfDay}
                                    {timezone && ` (${timezone})`}
                                  </Typography>
                                )}
                                {dayOfWeek && (
                                  <Typography variant="body2" color="text.secondary">
                                    Day: {formatDayOfWeek(dayOfWeek)}
                                  </Typography>
                                )}
                                {dayOfMonth && (
                                  <Typography variant="body2" color="text.secondary">
                                    Day of Month: {dayOfMonth}
                                  </Typography>
                                )}
                                {startAfter && (
                                  <Typography variant="body2" color="text.secondary">
                                    Starts: {format(new Date(startAfter), 'MMM d, yyyy h:mm a')}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                                  ID: {schedId}
                                </Typography>
                              </>
                            );
                          })()}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < validSchedules.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          </Box>
        )}

        {hasProperties && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon fontSize="small" />
              Refresh Properties
            </Typography>
            
            <Box sx={{ 
              bgcolor: 'background.paper', 
              borderRadius: 1, 
              border: '1px solid', 
              borderColor: 'divider',
              p: 2
            }}>
              {dataSetRefreshProperties.failureConfiguration && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Failure Configuration
                  </Typography>
                  {dataSetRefreshProperties.failureConfiguration.emailAlert && (
                    <Typography variant="body2" color="text.secondary">
                      Email Alerts: {dataSetRefreshProperties.failureConfiguration.emailAlert.alertStatus || 'Not configured'}
                    </Typography>
                  )}
                </Box>
              )}
              
              {dataSetRefreshProperties.refreshConfiguration && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Refresh Configuration
                  </Typography>
                  {dataSetRefreshProperties.refreshConfiguration.incrementalRefresh && (
                    <Box sx={{ ml: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Incremental Refresh Enabled
                      </Typography>
                      {dataSetRefreshProperties.refreshConfiguration.incrementalRefresh.lookbackWindow && (
                        <Typography variant="body2" color="text.secondary">
                          Lookback Window: {dataSetRefreshProperties.refreshConfiguration.incrementalRefresh.lookbackWindow.size} {dataSetRefreshProperties.refreshConfiguration.incrementalRefresh.lookbackWindow.sizeUnit?.toLowerCase()}(s)
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}