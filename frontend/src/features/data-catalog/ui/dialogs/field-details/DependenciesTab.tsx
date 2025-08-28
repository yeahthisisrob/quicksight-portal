/**
 * Dependencies tab for calculated field details
 */
import { AccountTree as DependencyIcon } from '@mui/icons-material';
import {
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

interface DependenciesTabProps {
  fieldReferences: string[];
  allCalculatedFields: any[];
}

export function DependenciesTab({ fieldReferences, allCalculatedFields }: DependenciesTabProps) {
  const getDependencyType = (fieldName: string) => {
    const isCalculated = allCalculatedFields.some(f => f.fieldName === fieldName);
    return isCalculated ? 'calculated' : 'physical';
  };
  
  if (fieldReferences.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No field dependencies found in the expression
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Field Dependencies ({fieldReferences.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This calculated field references the following fields in its expression:
        </Typography>
        <List>
          {fieldReferences.map((fieldName) => {
            const depType = getDependencyType(fieldName);
            return (
              <ListItem key={fieldName}>
                <ListItemIcon>
                  <DependencyIcon color={depType === 'calculated' ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText 
                  primary={fieldName}
                  secondary={
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip 
                        label={depType === 'calculated' ? 'Calculated Field' : 'Physical Field'}
                        size="small"
                        color={depType === 'calculated' ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </Stack>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>
    </Stack>
  );
}