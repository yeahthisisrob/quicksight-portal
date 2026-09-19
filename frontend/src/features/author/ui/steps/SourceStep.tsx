/**
 * Step 1 - pick the dashboard or analysis to start from. Templates first.
 */
import { Search, Star, StarBorder } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { DefinitionWireframe, type RebindSource } from '@/entities/definition';

import { assetsApi } from '@/shared/api';
import { useDebounce } from '@/shared/lib/useDebounce';

import { displayTags, isTemplate, templateIncludeTagsParam } from '../../model/templateTag';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

type SourceType = RebindSource['type'];

interface SourceItem {
  id: string;
  name: string;
  tags?: Array<{ key: string; value: string }>;
}

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;
const PREVIEW_MAX_HEIGHT = 440;

async function listSources(type: SourceType, search: string, templatesOnly: boolean) {
  const params = {
    search: search || undefined,
    pageSize: PAGE_SIZE,
    page: 1,
    includeTags: templatesOnly ? templateIncludeTagsParam() : undefined,
  };
  if (type === 'dashboard') {
    return (await assetsApi.getDashboardsPaginated(params)).dashboards as SourceItem[];
  }
  return (await assetsApi.getAnalysesPaginated(params)).analyses as SourceItem[];
}

function SourceRow({
  item,
  selected,
  onSelect,
}: {
  item: SourceItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const template = isTemplate(item.tags);
  const tags = displayTags(item.tags);
  return (
    <ListItemButton selected={selected} onClick={onSelect} sx={{ borderRadius: 2, mb: 0.5 }}>
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            {template && <Star sx={{ fontSize: 16, color: 'warning.main' }} />}
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {item.name}
            </Typography>
          </Stack>
        }
        secondary={
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
              {item.id}
            </Typography>
            {tags.slice(0, 4).map((t) => (
              <Chip key={t.key} size="small" variant="outlined" label={`${t.key}: ${t.value}`} />
            ))}
          </Stack>
        }
        slotProps={{ secondary: { component: 'div' } }}
      />
    </ListItemButton>
  );
}

function SourceList({
  title,
  items,
  loading,
  selectedId,
  onSelect,
  emptyText,
}: {
  title: string;
  items: SourceItem[] | undefined;
  loading: boolean;
  selectedId?: string;
  onSelect: (item: SourceItem) => void;
  emptyText: string;
}) {
  return (
    <Box>
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.8 }}
      >
        {title}
      </Typography>
      {loading && (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={20} />
        </Box>
      )}
      {!loading && items?.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
          {emptyText}
        </Typography>
      )}
      {!loading && items && items.length > 0 && (
        <List disablePadding>
          {items.map((item) => (
            <SourceRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item)}
            />
          ))}
        </List>
      )}
    </Box>
  );
}

export function SourceStep({ flow }: { flow: AuthorFlow }) {
  const [type, setType] = useState<SourceType>(flow.state.source?.type ?? 'dashboard');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const templates = useQuery({
    queryKey: ['author-sources', type, 'templates'],
    queryFn: () => listSources(type, '', true),
  });
  const results = useQuery({
    queryKey: ['author-sources', type, 'search', debounced],
    queryFn: () => listSources(type, debounced, false),
  });

  const source = flow.state.source;
  const select = (item: SourceItem) => flow.selectSource({ type, id: item.id, name: item.name });

  const noun = type === 'dashboard' ? 'dashboard' : 'analysis';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 2fr) 3fr' },
        gap: 2.5,
        alignItems: 'start',
      }}
    >
      <Panel
        title="Start from"
        description="Templates are dashboards and analyses tagged for reuse. Anything else is a search away."
      >
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={type}
            onChange={(_, next: SourceType | null) => next && setType(next)}
          >
            <ToggleButton value="dashboard">Dashboards</ToggleButton>
            <ToggleButton value="analysis">Analyses</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small"
            placeholder={`Search ${noun === 'dashboard' ? 'dashboards' : 'analyses'}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {!search && (
            <SourceList
              title="Templates"
              items={templates.data}
              loading={templates.isLoading}
              selectedId={source?.id}
              onSelect={select}
              emptyText="No templates yet. Pick any source and mark it as a template."
            />
          )}
          <SourceList
            title={search ? 'Results' : `Other ${noun === 'dashboard' ? 'dashboards' : 'analyses'}`}
            // Templates already have their own list above when not searching.
            items={search ? results.data : results.data?.filter((item) => !isTemplate(item.tags))}
            loading={results.isLoading}
            selectedId={source?.id}
            onSelect={select}
            emptyText="Nothing matches."
          />
        </Stack>
      </Panel>

      <Panel
        title={source ? source.name : 'Nothing selected'}
        description={
          source
            ? `${source.type === 'dashboard' ? 'Dashboard' : 'Analysis'} · ${source.id}`
            : 'Pick a source on the left to see its layout here.'
        }
        actions={
          source && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={flow.source.isTemplate ? <Star /> : <StarBorder />}
                onClick={() => flow.setTemplate(source, !flow.source.isTemplate)}
              >
                {flow.source.isTemplate ? 'Template' : 'Mark as template'}
              </Button>
              <Button variant="contained" onClick={flow.next}>
                Continue
              </Button>
            </>
          )
        }
      >
        {!source && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              The mockup you will see later starts from this layout.
            </Typography>
          </Box>
        )}
        {source && flow.source.loading && (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}
        {source && flow.source.error && <Alert severity="error">{flow.source.error}</Alert>}
        {source && !flow.source.loading && !flow.source.error && !flow.source.model && (
          <Alert severity="info">
            No definition is cached for this {noun} yet. You can still rebind it; the mockup step
            needs an export with definitions first.
          </Alert>
        )}
        {source && flow.source.model && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusIndicator kind="success">Definition cached</StatusIndicator>
              {displayTags(flow.source.tags).map((t) => (
                <Chip key={t.key} size="small" variant="outlined" label={`${t.key}: ${t.value}`} />
              ))}
            </Stack>
            <Box sx={{ maxHeight: PREVIEW_MAX_HEIGHT, overflow: 'auto' }}>
              <DefinitionWireframe model={flow.source.model} />
            </Box>
          </Stack>
        )}
      </Panel>
    </Box>
  );
}
