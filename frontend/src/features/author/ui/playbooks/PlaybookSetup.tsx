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

import { ModelPill, useAiModels } from '@/entities/ai-model';
import { ThemePicker } from '@/entities/theme';

import { assetsApi } from '@/shared/api';
import type { GateValues, Playbook, PlaybookGate } from '@/shared/api/modules/playbooks';

import type { StudioFolder } from '../../model/studio';
import { FolderPicker } from '../FolderPicker';

const DATASOURCE_PAGE = 100;
/** Engines a data source can be; any other can be typed. */
const ENGINES = [
  'ATHENA',
  'REDSHIFT',
  'S3',
  'SNOWFLAKE',
  'DATABRICKS',
  'POSTGRESQL',
  'AURORA_POSTGRESQL',
  'MYSQL',
  'SQLSERVER',
  'ORACLE',
  'TIMESTREAM',
];

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
    queryFn: async () => {
      const wanted = param.dataSourceType?.toUpperCase();
      const rows: Array<{ id: string; name: string }> = [];
      // Every page: an account can have more data sources than one page holds.
      for (let page = 1; ; page += 1) {
        const data = await assetsApi.getDatasourcesPaginated({ pageSize: DATASOURCE_PAGE, page });
        for (const d of data.datasources) {
          if (!wanted || d.sourceType.toUpperCase() === wanted)
            rows.push({ id: d.id, name: d.name });
        }
        if (page >= (data.pagination.totalPages ?? 1) || data.datasources.length === 0) break;
      }
      return rows;
    },
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

/** Which model judges what rules cannot; chosen once, kept for next time. */
function ReviewModel() {
  const models = useAiModels();
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Model
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Some steps ask a model, e.g. to map columns whose names differ. Every answer is checked;
        anything it is unsure of goes to review.
      </Typography>
      <ModelPill work="review" models={models} />
    </Box>
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
            ) : param.kind === 'folder' ? (
              <Box key={param.key} sx={{ maxWidth: 480 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {param.label}
                  {param.required ? ' *' : ''}
                </Typography>
                <FolderPicker
                  value={(params[param.key] as StudioFolder | undefined) ?? null}
                  onChange={(folder) => onParam(param.key, folder ?? undefined)}
                />
              </Box>
            ) : param.kind === 'theme' ? (
              <ThemePicker
                key={param.key}
                label={`${param.label}${param.required ? ' *' : ''}`}
                value={(params[param.key] as string | undefined) ?? ''}
                onChange={(theme) => onParam(param.key, theme)}
                width={360}
              />
            ) : param.kind === 'engine' ? (
              <Autocomplete
                key={param.key}
                freeSolo
                size="small"
                options={ENGINES}
                value={(params[param.key] as string | undefined) ?? ''}
                onInputChange={(_, value) => onParam(param.key, value.toUpperCase())}
                renderInput={(input) => (
                  <TextField
                    {...input}
                    label={param.label}
                    required={param.required}
                    helperText={param.help}
                  />
                )}
                sx={{ maxWidth: 320 }}
              />
            ) : param.kind === 'number' ? (
              <TextField
                key={param.key}
                size="small"
                type="number"
                label={param.label}
                required={param.required}
                helperText={param.help}
                value={(params[param.key] as number | string | undefined) ?? ''}
                onChange={(e) =>
                  onParam(param.key, e.target.value === '' ? '' : Number(e.target.value))
                }
                sx={{ maxWidth: 200 }}
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

      {playbook.infers && <ReviewModel />}

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
