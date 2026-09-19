/**
 * Step 1 - pick the dashboard or analysis to start from. Templates first,
 * then the popular ones, then the rest; each row says how much it is used.
 * The preview on the right shows the layout with slow or failing visuals
 * flagged, and an insights card above it.
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
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { DefinitionWireframe, type RebindSource } from '@/entities/definition';

import { assetsApi, getApiErrorMessage } from '@/shared/api';
import type { SearchHit } from '@/shared/api/modules/search';
import { SegmentedControl } from '@/shared/design-system';
import { SEARCH_MIN_LENGTH, useSearchHits } from '@/shared/lib/search';
import { SearchHitList } from '@/shared/ui';

import {
  compactNumber,
  GROUP_LABELS,
  type RankableSource,
  type RankedSource,
  rankSources,
  SOURCE_SORTS,
  type SourceBadge,
  type SourceGroup,
  type SourceSort,
  timeAgo,
  viewers,
  views,
} from '../../lib/ranking';
import { displayTags, templateIncludeTagsParam } from '../../model/templateTag';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { InsightsCard } from '../InsightsCard';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

type SourceType = RebindSource['type'];

type SourceItem = RankableSource;

const PAGE_SIZE = 50;
const PREVIEW_MAX_HEIGHT = 440;
const MAX_TAGS = 2;

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

const BADGE_PROPS: Record<
  SourceBadge,
  { label: string; color: 'warning' | 'success' | 'default'; title: string }
> = {
  template: { label: 'Template', color: 'warning', title: 'Tagged for reuse' },
  popular: { label: 'Popular', color: 'success', title: 'In the top quarter by views' },
  unused: { label: 'Unused', color: 'default', title: 'No views in the last 90 days' },
};

function SourceRow({
  ranked,
  selected,
  onSelect,
}: {
  ranked: RankedSource<SourceItem>;
  selected: boolean;
  onSelect: () => void;
}) {
  const { item, badges } = ranked;
  const tags = displayTags(item.tags).slice(0, MAX_TAGS);
  const last = timeAgo(item.activity?.lastViewed);
  const viewCount = views(item);
  return (
    <ListItemButton
      selected={selected}
      onClick={onSelect}
      sx={{ borderRadius: 2, mb: 0.5, alignItems: 'flex-start' }}
      data-testid={`source-row-${item.id}`}
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            {badges.includes('template') && <Star sx={{ fontSize: 16, color: 'warning.main' }} />}
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
              {item.name}
            </Typography>
            {badges.map((badge) => (
              <Tooltip key={badge} title={BADGE_PROPS[badge].title}>
                <Chip
                  size="small"
                  color={BADGE_PROPS[badge].color}
                  variant={badge === 'unused' ? 'outlined' : 'filled'}
                  label={BADGE_PROPS[badge].label}
                  data-badge={badge}
                  sx={{ height: 20 }}
                />
              </Tooltip>
            ))}
          </Stack>
        }
        secondary={
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {viewCount > 0
                ? `${compactNumber(viewCount)} views · ${compactNumber(viewers(item))} viewers`
                : 'No views recorded'}
              {last ? ` · last viewed ${last}` : ''}
            </Typography>
            {tags.map((t) => (
              <Chip
                key={t.key}
                size="small"
                variant="outlined"
                label={`${t.key}: ${t.value}`}
                sx={{ height: 18, fontSize: '0.6875rem' }}
              />
            ))}
          </Stack>
        }
        slotProps={{ secondary: { component: 'div' } }}
      />
    </ListItemButton>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      component="div"
      sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.8, mt: 1 }}
    >
      {children}
    </Typography>
  );
}

function RankedList({
  ranked,
  loading,
  selectedId,
  onSelect,
  emptyText,
}: {
  ranked: RankedSource<SourceItem>[];
  loading: boolean;
  selectedId?: string;
  onSelect: (item: SourceItem) => void;
  emptyText: string;
}) {
  if (loading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (ranked.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        {emptyText}
      </Typography>
    );
  }
  let lastGroup: SourceGroup | null = null;
  return (
    <List disablePadding data-testid="source-list">
      {ranked.map((entry) => {
        const heading = entry.group !== lastGroup ? GROUP_LABELS[entry.group] : null;
        lastGroup = entry.group;
        return (
          <Box key={entry.item.id}>
            {heading && <GroupHeading>{heading}</GroupHeading>}
            <SourceRow
              ranked={entry}
              selected={entry.item.id === selectedId}
              onSelect={() => onSelect(entry.item)}
            />
          </Box>
        );
      })}
    </List>
  );
}

/** Ranked hits from /search, each saying why it matched; a click makes it the source. */
function SearchResults({
  search,
  selectedId,
  onSelect,
}: {
  search: ReturnType<typeof useSearchHits>;
  selectedId?: string;
  onSelect: (hit: SearchHit) => void;
}) {
  if (search.error) {
    return (
      <Typography variant="body2" color="error" sx={{ py: 1 }}>
        {getApiErrorMessage(search.error, 'Search failed')}
      </Typography>
    );
  }
  if (search.loading && search.hits.length === 0) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (search.hits.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        Nothing matches "{search.query}". Names, columns, calculated fields, tags and folders all
        count.
      </Typography>
    );
  }
  const selectedIndex = search.hits.findIndex((h) => h.id === selectedId);
  return (
    <SearchHitList
      flat
      hits={search.hits}
      selectedIndex={selectedIndex}
      onSelect={(hit) => onSelect(hit)}
    />
  );
}

/** One list from the templates call and the search call, without duplicates. */
function merge(templates: SourceItem[] | undefined, results: SourceItem[] | undefined) {
  const seen = new Set<string>();
  const out: SourceItem[] = [];
  for (const item of [...(templates ?? []), ...(results ?? [])]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

export function SourceStep({
  flow,
  initialSearch = '',
}: {
  flow: AuthorFlow;
  /** Text in the search box at first render (stories). */
  initialSearch?: string;
}) {
  const [type, setType] = useState<SourceType>(flow.state.source?.type ?? 'dashboard');
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SourceSort>('views');
  // Typing searches everything the portal knows about this kind of asset, by
  // name, column, calculated field, tag or folder; the ranked list is for
  // browsing when the box is empty.
  const searching = search.trim().length >= SEARCH_MIN_LENGTH;
  const found = useSearchHits(search, { types: [type], enabled: searching });

  const templates = useQuery({
    queryKey: ['author-sources', type, 'templates'],
    queryFn: () => listSources(type, '', true),
    enabled: !searching,
  });
  const results = useQuery({
    queryKey: ['author-sources', type, 'list'],
    queryFn: () => listSources(type, '', false),
    enabled: !searching,
  });

  const ranked = useMemo(
    () => rankSources(merge(templates.data, results.data), sort),
    [templates.data, results.data, sort]
  );

  const source = flow.state.source;
  const select = (item: SourceItem) => flow.selectSource({ type, id: item.id, name: item.name });

  const noun = type === 'dashboard' ? 'dashboard' : 'analysis';
  // Every visual with metrics carries a badge; only slow and failing ones are flags.
  const flagged = Array.from(flow.healthBadges.values()).filter((b) => b.kind !== 'timing').length;
  const plural = type === 'dashboard' ? 'dashboards' : 'analyses';

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
        title="Start from what works"
        description="Templates first, then the most viewed. Slow or failing visuals are flagged on the preview."
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={type}
              onChange={(_, next: SourceType | null) => next && setType(next)}
            >
              <ToggleButton value="dashboard">Dashboards</ToggleButton>
              <ToggleButton value="analysis">Analyses</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <SegmentedControl<SourceSort>
              size="small"
              ariaLabel="Sort sources"
              value={sort}
              onChange={setSort}
              options={SOURCE_SORTS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Stack>

          <TextField
            size="small"
            placeholder={`Search ${plural}`}
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

          {searching ? (
            <SearchResults
              search={found}
              selectedId={source?.id}
              onSelect={(hit) => flow.selectSource({ type, id: hit.id, name: hit.name })}
            />
          ) : (
            <RankedList
              ranked={ranked}
              loading={results.isLoading || templates.isLoading}
              selectedId={source?.id}
              onSelect={select}
              emptyText={`No ${plural} yet.`}
            />
          )}
        </Stack>
      </Panel>

      <Panel
        title={source ? source.name : 'Nothing selected'}
        description={
          source
            ? `${source.type === 'dashboard' ? 'Dashboard' : 'Analysis'} · ${source.id}`
            : 'Pick a source on the left to see how it is used and what it looks like.'
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
              {flow.standard.candidates.items.some((c) => c.id !== source.id) && (
                <Tooltip title="Pick a template dashboard as the layout standard and convert visual types in bulk">
                  <Button size="small" variant="outlined" onClick={() => flow.goTo('standard')}>
                    Migrate onto a standard
                  </Button>
                </Tooltip>
              )}
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
        {source && (
          <Stack spacing={2}>
            <InsightsCard insights={flow.insights} />
            {flow.source.loading && (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}
            {flow.source.error && <Alert severity="error">{flow.source.error}</Alert>}
            {!flow.source.loading && !flow.source.error && !flow.source.model && (
              <Alert severity="info">
                No definition is cached for this {noun} yet. You can still rebind it; the mockup
                step needs an export with definitions first.
              </Alert>
            )}
            {flow.source.model && (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusIndicator kind="success">Definition cached</StatusIndicator>
                  {flow.repair.summary.total > 0 && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => flow.goTo('repair')}
                    >
                      {flow.repair.summary.total} issue
                      {flow.repair.summary.total === 1 ? '' : 's'} to repair
                    </Button>
                  )}
                  {flagged > 0 && (
                    <StatusIndicator kind="warning">
                      {flagged} visual{flagged === 1 ? '' : 's'} flagged on the preview
                    </StatusIndicator>
                  )}
                  {displayTags(flow.source.tags).map((t) => (
                    <Chip
                      key={t.key}
                      size="small"
                      variant="outlined"
                      label={`${t.key}: ${t.value}`}
                    />
                  ))}
                </Stack>
                <Box sx={{ maxHeight: PREVIEW_MAX_HEIGHT, overflow: 'auto' }}>
                  <DefinitionWireframe model={flow.source.model} badges={flow.healthBadges} />
                </Box>
              </Stack>
            )}
          </Stack>
        )}
      </Panel>
    </Box>
  );
}
