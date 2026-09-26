/**
 * What a playbook needs before it looks: its parameters, and the
 * conditions (gates) an asset must pass. A gate that is on shows its value;
 * turned off, it holds nothing back.
 */
import { VisibilityOutlined } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { assetsApi } from '@/shared/api';
import type { GateValues, Playbook, PlaybookGate } from '@/shared/api/modules/playbooks';

const DATASOURCE_PAGE = 100;

type Param = Playbook['params'][number];

function DataSourceParam({
  param,
  value,
  onChange,
}: {
  param: Param;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const sources = useQuery({
    queryKey: ['playbook-datasources', param.dataSourceType ?? 'any'],
    queryFn: async () =>
      (await assetsApi.getDatasourcesPaginated({ pageSize: DATASOURCE_PAGE, page: 1 })).datasources
        .filter((d) => !param.dataSourceType || d.type === param.dataSourceType)
        .map((d) => ({ id: d.id, name: d.name })),
  });
  const options = sources.data ?? [];
  return (
    <Autocomplete
      size="small"
      options={options}
      loading={sources.isLoading}
      value={options.find((o) => o.id === value) ?? null}
      onChange={(_, next) => onChange(next?.id)}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Box>
            <Typography variant="body2">{option.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {option.id}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(input) => (
        <TextField
          {...input}
          label={param.label}
          required={param.required}
          helperText={param.help}
        />
      )}
      sx={{ maxWidth: 480 }}
    />
  );
}

function GateField({
  gate,
  value,
  onChange,
}: {
  gate: PlaybookGate;
  value: number | string | boolean | null | undefined;
  onChange: (value: number | string | boolean | null) => void;
}) {
  const on = value !== null && value !== undefined && value !== '' && value !== false;
  if (gate.kind === 'boolean') {
    return (
      <FormControlLabel
        control={<Switch checked={on} onChange={(e) => onChange(e.target.checked || null)} />}
        label={gate.label}
      />
    );
  }
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Tooltip title={on ? 'Turn off' : 'Turn on'}>
        <Switch
          size="small"
          checked={on}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? ((gate.default as never) ?? (gate.kind === 'number' ? 1 : ''))
                : null
            )
          }
          slotProps={{ input: { 'aria-label': gate.label } }}
        />
      </Tooltip>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ color: on ? 'text.primary' : 'text.secondary' }}>
          {gate.label}
        </Typography>
        {gate.help && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {gate.help}
          </Typography>
        )}
      </Box>
      <TextField
        size="small"
        type={gate.kind === 'number' ? 'number' : 'text'}
        disabled={!on}
        value={on ? String(value) : ''}
        onChange={(e) =>
          onChange(
            gate.kind === 'number'
              ? e.target.value === ''
                ? null
                : Number(e.target.value)
              : e.target.value || null
          )
        }
        slotProps={{ htmlInput: gate.kind === 'number' ? { min: 1 } : {} }}
        sx={{ width: gate.kind === 'number' ? 96 : 200 }}
      />
    </Stack>
  );
}

export function PlaybookSetup({
  playbook,
  params,
  onParam,
  gates,
  onGate,
  ready,
  busy,
  onPreview,
}: {
  playbook: Playbook;
  params: Record<string, unknown>;
  onParam: (key: string, value: unknown) => void;
  gates: GateValues;
  onGate: (key: string, value: number | string | boolean | null) => void;
  ready: boolean;
  busy: boolean;
  onPreview: () => void;
}) {
  return (
    <Stack spacing={3}>
      {playbook.params.length > 0 && (
        <Stack spacing={2}>
          {playbook.params.map((param) =>
            param.kind === 'datasource' ? (
              <DataSourceParam
                key={param.key}
                param={param}
                value={params[param.key] as string | undefined}
                onChange={(id) => onParam(param.key, id)}
              />
            ) : param.kind === 'boolean' ? (
              <FormControlLabel
                key={param.key}
                control={
                  <Switch
                    checked={Boolean(params[param.key])}
                    onChange={(e) => onParam(param.key, e.target.checked)}
                  />
                }
                label={param.label}
              />
            ) : (
              <TextField
                key={param.key}
                size="small"
                label={param.label}
                required={param.required}
                helperText={param.help}
                value={(params[param.key] as string | undefined) ?? ''}
                onChange={(e) => onParam(param.key, e.target.value)}
                sx={{ maxWidth: 480 }}
              />
            )
          )}
        </Stack>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Conditions
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Assets that fail one are listed as skipped, with the reason. Anything tagged
          portal:playbook-skip is always left alone.
        </Typography>
        <Stack spacing={1.5}>
          {playbook.gates.map((gate) => (
            <GateField
              key={gate.key}
              gate={gate}
              value={gates[gate.key]}
              onChange={(value) => onGate(gate.key, value)}
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <VisibilityOutlined />}
          disabled={!ready || busy}
          onClick={onPreview}
        >
          Preview
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1.5 }}>
          Checks every asset; changes nothing.
        </Typography>
      </Box>
    </Stack>
  );
}
