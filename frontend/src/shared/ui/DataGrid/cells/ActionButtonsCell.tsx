import {
  Code as CodeIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import React from 'react';

export type ActionCellIconType = 'info' | 'edit' | 'delete' | 'code';

export interface ActionButton {
  /** Icon type to display */
  icon: ActionCellIconType;
  /** Callback when button is clicked */
  onClick: () => void;
  /** Optional tooltip text */
  tooltip?: string;
  /** Button color variant */
  color?: 'default' | 'primary' | 'error' | 'success' | 'warning' | 'info';
}

export interface ActionButtonsCellProps {
  /** Array of action buttons to render */
  actions: ActionButton[];
  /** Button size */
  size?: 'small' | 'medium';
  /** Gap between buttons */
  gap?: number;
}

const iconMap: Record<ActionCellIconType, React.ElementType> = {
  info: InfoIcon,
  edit: EditIcon,
  delete: DeleteIcon,
  code: CodeIcon,
};

/**
 * Reusable cell component for displaying action buttons in DataGrid.
 * Supports common action icons with optional tooltips.
 */
export const ActionButtonsCell: React.FC<ActionButtonsCellProps> = ({
  actions,
  size = 'small',
  gap = 0.5,
}) => {
  return (
    <Box sx={{ display: 'flex', gap }}>
      {actions.map((action, index) => {
        const Icon = iconMap[action.icon];
        const button = (
          <IconButton
            key={index}
            size={size}
            onClick={action.onClick}
            color={action.color === 'default' ? undefined : action.color}
          >
            <Icon fontSize={size} />
          </IconButton>
        );

        if (action.tooltip) {
          return (
            <Tooltip key={index} title={action.tooltip}>
              {button}
            </Tooltip>
          );
        }

        return button;
      })}
    </Box>
  );
};

export default ActionButtonsCell;
