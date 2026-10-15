/**
 * The "Same table" cell on the Datasets page: how many other datasets read
 * one of this dataset's tables, as the table or inside a query. The count
 * opens the dataset in the Studio, whose Same table panel lists them.
 */
import { Chip, Tooltip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface SameTableCellProps {
  id: string;
  name: string;
  /** Null when the portal knows no table for it. */
  count: number | null;
}

export function SameTableCell({ id, name, count }: SameTableCellProps) {
  const navigate = useNavigate();
  if (count === null) {
    return (
      <Tooltip
        title="No table known for this dataset: it reads files, or its definition has not been parsed yet."
        enterDelay={300}
      >
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Unknown
        </Typography>
      </Tooltip>
    );
  }
  if (count === 0) {
    return (
      <Tooltip title="No other dataset reads its tables." enterDelay={300}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Only this one
        </Typography>
      </Tooltip>
    );
  }
  return (
    <Tooltip
      title={`${count} other dataset${count === 1 ? '' : 's'} read${count === 1 ? 's' : ''} one of the same tables, as the table or inside a query. Click to see which in the Studio.`}
      enterDelay={300}
    >
      <Chip
        label={`+${count}`}
        size="small"
        color="warning"
        variant="outlined"
        onClick={(event) => {
          event.stopPropagation();
          navigate(
            `/author?tab=studio&type=dataset&id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`
          );
        }}
      />
    </Tooltip>
  );
}
