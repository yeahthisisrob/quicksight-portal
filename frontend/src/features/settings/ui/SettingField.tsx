import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import type { SettingDefinition } from '@/shared/api/modules/settings';
import { pal, StatusIndicator } from '@/shared/design-system';

import { displayValue, type SettingsDraft, type SettingValue } from '../model/settingsForm';
import { RemoteMultiSelect } from './RemoteMultiSelect';
import { SourceBadge } from './SourceBadge';

interface SettingFieldProps {
  definition: SettingDefinition;
  draft: SettingsDraft;
  onSet: (value: SettingValue) => void;
  onReset: () => void;
  onRevert: () => void;
  disabled?: boolean;
}

const asString = (v: SettingValue | null | undefined) => (typeof v === 'string' ? v : '');
const asList = (v: SettingValue | null | undefined) => (Array.isArray(v) ? v : []);
const asBool = (v: SettingValue | null | undefined) =>
  typeof v === 'boolean' ? v : typeof v === 'string' ? v === 'true' : false;

/**
 * One setting: its control, where the value comes from, and the env var it
 * falls back to. The control is chosen from the definition's `type`, so the
 * page never hard-codes a form.
 */
export function SettingField({
  definition,
  draft,
  onSet,
  onReset,
  onRevert,
  disabled,
}: SettingFieldProps) {
  const touched = definition.key in draft;
  const current = displayValue(definition, draft);
  const resetPending = touched && current === null;
  const canReset = definition.source === 'stored' && !touched && !definition.sensitive;

  const control = (() => {
    if (definition.sensitive) {
      const isSet = Boolean(definition.value);
      return (
        <StatusIndicator type={isSet ? 'success' : 'warning'}>
          {isSet ? 'Set via environment' : 'Not set in the environment'}
        </StatusIndicator>
      );
    }
    if (resetPending) {
      return (
        <StatusIndicator type="pending">
          Will fall back to{' '}
          {definition.envVar ? `the environment (${definition.envVar})` : 'the default'} on save
        </StatusIndicator>
      );
    }
    switch (definition.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={asBool(current)}
                onChange={(e) => onSet(e.target.checked)}
                disabled={disabled}
              />
            }
            label={asBool(current) ? 'On' : 'Off'}
          />
        );
      case 'select':
        return (
          <FormControl size="small" fullWidth disabled={disabled}>
            <InputLabel id={`${definition.key}-label`}>{definition.label}</InputLabel>
            <Select
              labelId={`${definition.key}-label`}
              label={definition.label}
              value={asString(current)}
              onChange={(e) => onSet(e.target.value)}
            >
              {(definition.options ?? []).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'multiselect':
        return definition.optionsFrom ? (
          <RemoteMultiSelect
            optionsFrom={definition.optionsFrom}
            value={asList(current)}
            onChange={onSet}
            label={definition.label}
            disabled={disabled}
            emptyHint="Nothing selected means every project."
          />
        ) : (
          <FormControl size="small" fullWidth disabled={disabled}>
            <InputLabel id={`${definition.key}-label`}>{definition.label}</InputLabel>
            <Select
              multiple
              labelId={`${definition.key}-label`}
              label={definition.label}
              value={asList(current)}
              onChange={(e) =>
                onSet(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
              }
            >
              {(definition.options ?? []).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'text':
        return (
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={3}
            maxRows={12}
            label={definition.label}
            value={asString(current)}
            onChange={(e) => onSet(e.target.value)}
            disabled={disabled}
            placeholder={definition.source === 'default' ? 'Not set' : undefined}
          />
        );
      default:
        return (
          <TextField
            size="small"
            fullWidth
            label={definition.label}
            value={asString(current)}
            onChange={(e) => onSet(e.target.value)}
            disabled={disabled}
            placeholder={definition.source === 'default' ? 'Not set' : undefined}
          />
        );
    }
  })();

  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
        gap: 2,
        py: 2,
        borderBottom: `1px solid ${pal(theme).line.divider}`,
        '&:last-of-type': { borderBottom: 'none' },
      })}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" component="label" htmlFor={definition.key}>
            {definition.label}
          </Typography>
          <SourceBadge source={definition.source} pending={touched} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {definition.description}
        </Typography>
        {definition.envVar && (
          <Typography
            variant="body2"
            sx={(theme) => ({
              mt: 0.5,
              fontFamily: 'monospace',
              color: pal(theme).text.muted,
            })}
          >
            {definition.envVar}
          </Typography>
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        {control}
        <Box sx={{ display: 'flex', gap: 1, mt: 1, minHeight: 28 }}>
          {canReset && (
            <Button size="small" variant="text" onClick={onReset}>
              Reset to environment
            </Button>
          )}
          {touched && (
            <Button size="small" variant="text" color="inherit" onClick={onRevert}>
              Undo change
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
