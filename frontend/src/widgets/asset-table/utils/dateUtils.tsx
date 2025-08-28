import { Typography, Tooltip } from '@mui/material';
import { format } from 'date-fns';

import { TypedChip } from '@/shared/ui';

export const formatDate = (date: string | Date | undefined) => {
  if (!date) return null;
  try {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  } catch {
    return null;
  }
};

export const formatRelativeDate = (date: string | Date | undefined) => {
  if (!date) return null;
  try {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return null;
  }
};

export const renderDateCell = (date: string | Date | undefined) => {
  const formattedDate = formatDate(date);
  const relativeDate = formatRelativeDate(date);
  
  if (!formattedDate || !relativeDate) {
    return <TypedChip type="UNKNOWN" size="small" />;
  }
  
  return (
    <Tooltip title={formattedDate}>
      <Typography variant="body2">
        {relativeDate}
      </Typography>
    </Tooltip>
  );
};