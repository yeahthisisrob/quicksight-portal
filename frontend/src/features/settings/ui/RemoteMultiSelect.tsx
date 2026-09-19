import { Autocomplete, Chip, Link, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { describeProjectDiagnostics } from '@/entities/smus';

import { getApiErrorMessage, settingsApi } from '@/shared/api';

export interface RemoteOption {
  value: string;
  label: string;
  description?: string;
}

/** Something to do about an empty list, rendered as a link in the helper text. */
export interface RemoteEmptyAction {
  label: string;
  to: string;
}

interface RemoteOptions {
  configured: boolean;
  options: RemoteOption[];
  /** Shown when the list is empty: how the options were looked for. */
  emptyDetail?: string;
  emptyAction?: RemoteEmptyAction;
  /** Shown under a non-empty list: where the options came from. */
  sourceNote?: string;
}

const EXPORT_DATE_FORMAT = 'MMM d, yyyy HH:mm';
const RUN_EXPORT_ACTION: RemoteEmptyAction = {
  label: 'Run one from Operations',
  to: '/operations?tab=smus',
};

/**
 * The API client already prefixes `/api`, so a definition that names the
 * endpoint with it still resolves to the same loader.
 */
export function loaderKey(optionsFrom: string): string {
  return optionsFrom.replace(/^\/api(?=\/)/, '');
}

/**
 * Where a multiselect's choices come from, keyed by the `optionsFrom`
 * endpoint the setting definition names. Adding a remote list is one entry.
 */
const LOADERS: Record<string, () => Promise<RemoteOptions>> = {
  '/settings/smus/projects': async () => {
    const result = await settingsApi.listSmusProjects();
    // Projects come from a live ListProjects unioned with the last export, so
    // the list works before any export has run; the export is what fills the
    // catalog for the projects chosen here.
    const source = result.exportedAt
      ? `Live from DataZone, plus the SMUS export at ${format(new Date(result.exportedAt), EXPORT_DATE_FORMAT)}.`
      : 'Live from DataZone. No SMUS export has run yet: pick projects, save, then run one.';
    return {
      configured: result.configured,
      emptyDetail: [describeProjectDiagnostics(result.diagnostics), source]
        .filter(Boolean)
        .join(' '),
      emptyAction: RUN_EXPORT_ACTION,
      sourceNote: source,
      options: result.projects.map((p) => ({
        value: p.id,
        label: p.name,
        description: p.description,
      })),
    };
  },
};

export interface RemoteMultiSelectProps {
  optionsFrom: string;
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  disabled?: boolean;
  /** Shown under the field when nothing is selected. */
  emptyHint?: string;
}

function helperText(
  query: { error: unknown; data?: RemoteOptions },
  value: string[],
  emptyHint?: string
): ReactNode {
  if (query.error) {
    return getApiErrorMessage(query.error, 'The options could not be loaded');
  }
  const data = query.data;
  if (!data) {
    return undefined;
  }
  if (!data.configured) {
    return 'No SMUS domain is configured, so there are no projects to choose from.';
  }
  if (data.options.length === 0) {
    return (
      <>
        {data.emptyDetail || 'No options were found.'}
        {data.emptyAction && (
          <>
            {' '}
            <Link component={RouterLink} to={data.emptyAction.to}>
              {data.emptyAction.label}
            </Link>
            .
          </>
        )}
      </>
    );
  }
  if (value.length === 0) {
    return [emptyHint, data.sourceNote].filter(Boolean).join(' ') || undefined;
  }
  return data.sourceNote;
}

/**
 * A multiselect whose options come from the server (SMUS projects, for
 * example). Selected values the list no longer contains are kept and shown
 * by id, so a stale selection is visible rather than silently dropped.
 */
export function RemoteMultiSelect({
  optionsFrom,
  value,
  onChange,
  label,
  disabled,
  emptyHint,
}: RemoteMultiSelectProps) {
  const loader = LOADERS[loaderKey(optionsFrom)];
  const query = useQuery({
    queryKey: ['settings-options', optionsFrom],
    queryFn: () =>
      loader
        ? loader()
        : Promise.reject(
            new Error(`No option loader for ${optionsFrom}; the UI is behind the API`)
          ),
  });

  const options = query.data?.options ?? [];
  const byValue = new Map(options.map((o) => [o.value, o]));
  const selected: RemoteOption[] = value.map((v) => byValue.get(v) ?? { value: v, label: v });
  const notConfigured = query.data && !query.data.configured;

  return (
    <Autocomplete
      multiple
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next.map((o) => o.value))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      loading={query.isLoading}
      disabled={disabled || notConfigured}
      size="small"
      renderOption={(props, option) => (
        <li {...props} key={option.value}>
          <span>
            {option.label}
            {option.description && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {option.description}
              </Typography>
            )}
          </span>
        </li>
      )}
      renderValue={(items, getItemProps) =>
        items.map((item, index) => {
          const { key, ...chipProps } = getItemProps({ index });
          return (
            <Chip
              key={key}
              size="small"
              label={item.label}
              color={byValue.has(item.value) ? 'default' : 'warning'}
              {...chipProps}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? 'Search' : undefined}
          error={Boolean(query.error)}
          helperText={helperText(query, value, emptyHint)}
        />
      )}
    />
  );
}

export default RemoteMultiSelect;
