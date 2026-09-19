/**
 * Calculated fields from the template library, added to the copy on publish.
 * The library is the portal's own store (SMUS has no home for calculated
 * fields); the catalog is where fields get saved into it.
 */
import { Close } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  IconButton,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';

import { calculatedFieldTemplatesApi } from '@/shared/api';
import type { CalculatedFieldTemplate } from '@/shared/api/modules/data-catalog';

import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';

export function TemplateFieldsPanel({ flow }: { flow: AuthorFlow }) {
  const templates = useQuery({
    queryKey: ['calculated-field-templates'],
    queryFn: () => calculatedFieldTemplatesApi.list(),
  });
  const identifiers = flow.draft.datasets.map((d) => d.identifier);
  const existing = new Map(
    flow.draft.datasets.map((d) => [d.identifier, new Set(d.calculatedFields)] as const)
  );
  const addedIds = new Set(flow.addedFields.map((f) => f.templateId));
  const options = (templates.data ?? []).filter((t) => !addedIds.has(t.id));

  if (identifiers.length === 0) {
    return null;
  }

  return (
    <Panel
      title="Calculated fields to add"
      description="From the template library. Each is added to the copy as a new calculated field on the dataset you choose."
    >
      <Stack spacing={2}>
        {templates.error ? (
          <Alert severity="warning">The template library could not be loaded.</Alert>
        ) : templates.data && templates.data.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No templates saved yet. Save one from a calculated field in the{' '}
            <Link component={RouterLink} to="/data-catalog">
              Catalog
            </Link>
            .
          </Typography>
        ) : (
          <Autocomplete<CalculatedFieldTemplate>
            options={options}
            value={null}
            onChange={(_, template) => {
              if (template) {
                flow.addTemplateField(template, identifiers[0]!);
              }
            }}
            getOptionLabel={(t) => t.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            loading={templates.isLoading}
            size="small"
            renderOption={(props, t) => (
              <li {...props} key={t.id}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                    noWrap
                  >
                    {t.expression}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Add a template" placeholder="Search the library" />
            )}
          />
        )}

        {flow.addedFields.map((field) => {
          const clash = existing.get(field.identifier)?.has(field.name);
          return (
            <Box
              key={field.templateId}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2">{field.name}</Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      color: 'text.secondary',
                      wordBreak: 'break-all',
                    }}
                  >
                    {field.expression}
                  </Typography>
                  {clash && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      A calculated field named {field.name} already exists on {field.identifier}. If
                      it has the same expression nothing is added; otherwise this one is published
                      as {field.name}_v2.
                    </Alert>
                  )}
                </Box>
                <TextField
                  select
                  size="small"
                  label="On dataset"
                  value={field.identifier}
                  onChange={(e) =>
                    flow.setTemplateFieldIdentifier(field.templateId, e.target.value)
                  }
                  sx={{ minWidth: 180 }}
                >
                  {identifiers.map((id) => (
                    <MenuItem key={id} value={id}>
                      {id}
                    </MenuItem>
                  ))}
                </TextField>
                <IconButton
                  size="small"
                  aria-label={`Remove ${field.name}`}
                  onClick={() => flow.removeTemplateField(field.templateId)}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Panel>
  );
}
