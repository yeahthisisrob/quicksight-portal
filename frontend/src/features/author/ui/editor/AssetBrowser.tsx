/**
 * The Editor's way in: every dashboard or analysis, what needs fixing first,
 * then templates, then the popular ones, then the rest. Each row says how
 * much it is used; a click opens it. Switched to Archived, it lists what was
 * deleted (datasets and data sources too), newest first, to restore.
 */
import { ErrorOutlined, Inventory2Outlined, Search, Star } from '@mui/icons-material';
import {
  Box,
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
import type { components } from '@shared/generated/types';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useState } from 'react';

import type { RebindSource } from '@/entities/definition';
import { PersonLabel } from '@/entities/user';

import { assetsApi, getApiErrorMessage } from '@/shared/api';
import type { SearchHit } from '@/shared/api/modules/search';
import { SegmentedControl } from '@/shared/design-system';
import { SEARCH_MIN_LENGTH, useSearchHits } from '@/shared/lib/search';
import { displayTags, templateIncludeTagsParam } from '@/shared/lib/templateTag';
import { SearchHitList } from '@/shared/ui';

import {
  compactNumber,
  errorCount,
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
import type { ArchivedPick, ArchivedType } from '../../model/useStudio';
import { Panel } from '../primitives/Panel';

type SourceType = RebindSource['type'];
type Scope = 'live' | 'archived';
type ArchivedItem = components['schemas']['ArchivedAssetItem'];

const ARCHIVED_TYPES: Array<{ value: ArchivedType; label: string }> = [
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'analysis', label: 'Analyses' },
  { value: 'dataset', label: 'Datasets' },
  { value: 'datasource', label: 'Data sources' },
];

type SourceItem = RankableSource;

const PAGE_SIZE = 50;
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
  { label: string; color: 'error' | 'warning' | 'success' | 'default'; title: string }
> = {
  errors: { label: 'Errors', color: 'error', title: 'QuickSight reports definition errors' },
  template: { label: 'Template', color: 'warning', title: 'Tagged for reuse' },
  popular: { label: 'Popular', color: 'success', title: 'In the top quarter by views' },
  unused: { label: 'Unused', color: 'default', title: 'No views in the last 90 days' },
};

function SourceRow({
  ranked,
  onSelect,
}: {
  ranked: RankedSource<SourceItem>;
  onSelect: () => void;
}) {
  const { item, badges } = ranked;
  const tags = displayTags(item.tags).slice(0, MAX_TAGS);
  const last = timeAgo(item.activity?.lastViewed);
  const viewCount = views(item);
  return (
    <ListItemButton
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
                  icon={badge === 'errors' ? <ErrorOutlined /> : undefined}
                  label={
                    badge === 'errors'
                      ? `${errorCount(item)} error${errorCount(item) === 1 ? '' : 's'}`
                      : BADGE_PROPS[badge].label
                  }
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
  onSelect,
  emptyText,
}: {
  ranked: RankedSource<SourceItem>[];
  loading: boolean;
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
            <SourceRow ranked={entry} onSelect={() => onSelect(entry.item)} />
          </Box>
        );
      })}
    </List>
  );
}

/** Ranked hits from /search, each saying why it matched; a click opens it. */
function SearchResults({
  search,
  onSelect,
}: {
  search: ReturnType<typeof useSearchHits>;
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
  return <SearchHitList flat hits={search.hits} onSelect={(hit) => onSelect(hit)} />;
}

function ArchivedRow({ item, onSelect }: { item: ArchivedItem; onSelect: () => void }) {
  const at = Date.parse(item.archivedDate);
  const restored = item.restorations?.[item.restorations.length - 1];
  return (
    <ListItemButton
      onClick={onSelect}
      sx={{ borderRadius: 2, mb: 0.5, alignItems: 'flex-start' }}
      data-testid={`archived-row-${item.id}`}
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Inventory2Outlined sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
              {item.name}
            </Typography>
            {restored && (
              <Tooltip title={`Restored as ${restored.restoredAs}`}>
                <Chip size="small" color="success" label="Restored" sx={{ height: 20 }} />
              </Tooltip>
            )}
          </Stack>
        }
        secondary={
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Archived {Number.isFinite(at) ? formatDistanceToNow(at, { addSuffix: true }) : ''}
              {item.archivedByPerson || item.archivedBy ? ' by' : ''}
            </Typography>
            {item.archivedByPerson ? (
              <PersonLabel person={item.archivedByPerson} variant="caption" />
            ) : (
              item.archivedBy && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {item.archivedBy}
                </Typography>
              )
            )}
            {item.archiveReason && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                · {item.archiveReason}
              </Typography>
            )}
          </Stack>
        }
        slotProps={{ secondary: { component: 'div' } }}
      />
    </ListItemButton>
  );
}

/** Archived assets of one kind, newest first; the search box filters them. */
function ArchivedList({
  type,
  search,
  onSelect,
}: {
  type: ArchivedType;
  search: string;
  onSelect: (pick: ArchivedPick) => void;
}) {
  const query = useQuery({
    queryKey: ['archived-assets', 'studio', type, search.trim()],
    queryFn: () =>
      assetsApi.getArchivedAssetsPaginated({
        type,
        search: search.trim() || undefined,
        pageSize: PAGE_SIZE,
        sortBy: 'archivedDate',
        sortOrder: 'desc',
      }),
  });
  if (query.isLoading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (query.error) {
    return (
      <Typography variant="body2" color="error" sx={{ py: 1 }}>
        {getApiErrorMessage(query.error, 'The archive could not be read')}
      </Typography>
    );
  }
  const items = (query.data?.items ?? []) as ArchivedItem[];
  if (items.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
        Nothing of this kind is archived{search.trim() ? ` matching "${search.trim()}"` : ''}.
      </Typography>
    );
  }
  return (
    <List disablePadding data-testid="archived-list">
      {items.map((item) => (
        <ArchivedRow
          key={item.id}
          item={item}
          onSelect={() => onSelect({ type, id: item.id, name: item.name })}
        />
      ))}
    </List>
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

export function AssetBrowser({
  onOpen,
  onOpenArchived,
  initialType = 'dashboard',
  initialSearch = '',
  initialScope = 'live',
}: {
  onOpen: (source: RebindSource) => void;
  /** Open something from the archive, to restore it. */
  onOpenArchived: (pick: ArchivedPick) => void;
  initialType?: SourceType;
  /** Text in the search box at first render (stories). */
  initialSearch?: string;
  initialScope?: Scope;
}) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [type, setType] = useState<SourceType>(initialType);
  const [archivedType, setArchivedType] = useState<ArchivedType>(initialType);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SourceSort>('views');
  // Typing searches everything the portal knows about this kind of asset, by
  // name, column, calculated field, tag or folder; the ranked list is for
  // browsing when the box is empty.
  const archive = scope === 'archived';
  const searching = !archive && search.trim().length >= SEARCH_MIN_LENGTH;
  const found = useSearchHits(search, { types: [type], enabled: searching });

  const templates = useQuery({
    queryKey: ['author-sources', type, 'templates'],
    queryFn: () => listSources(type, '', true),
    enabled: !searching && !archive,
  });
  const results = useQuery({
    queryKey: ['author-sources', type, 'list'],
    queryFn: () => listSources(type, '', false),
    enabled: !searching && !archive,
  });

  const ranked = useMemo(
    () => rankSources(merge(templates.data, results.data), sort),
    [templates.data, results.data, sort]
  );
  const broken = ranked.filter((r) => r.group === 'errors').length;
  const plural = type === 'dashboard' ? 'dashboards' : 'analyses';
  const archivedPlural =
    ARCHIVED_TYPES.find((t) => t.value === archivedType)?.label.toLowerCase() ?? 'assets';

  return (
    <Panel
      title={archive ? 'Restore something archived' : 'Open something to edit'}
      description={
        archive
          ? 'What was deleted through the portal, newest first. Dashboards and analyses open here with their errors to fix before they come back.'
          : broken > 0
            ? `${broken} ${broken === 1 ? (type === 'dashboard' ? 'dashboard needs' : 'analysis needs') : `${plural} need`} fixing; they come first. Then templates, then the most viewed.`
            : 'Templates first, then the most viewed. Anything with definition errors comes to the top.'
      }
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <SegmentedControl<Scope>
            size="small"
            ariaLabel="Live or archived"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          {archive ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={archivedType}
              onChange={(_, next: ArchivedType | null) => next && setArchivedType(next)}
            >
              {ARCHIVED_TYPES.map((t) => (
                <ToggleButton key={t.value} value={t.value}>
                  {t.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          ) : (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={type}
              onChange={(_, next: SourceType | null) => next && setType(next)}
            >
              <ToggleButton value="dashboard">Dashboards</ToggleButton>
              <ToggleButton value="analysis">Analyses</ToggleButton>
            </ToggleButtonGroup>
          )}
          <Box sx={{ flex: 1 }} />
          {!archive && (
            <SegmentedControl<SourceSort>
              size="small"
              ariaLabel="Sort"
              value={sort}
              onChange={setSort}
              options={SOURCE_SORTS.map((s) => ({ value: s.value, label: s.label }))}
            />
          )}
        </Stack>

        <TextField
          size="small"
          placeholder={
            archive
              ? `Search archived ${archivedPlural} by name, id or reason`
              : `Search ${plural} by name, column, calculated field, tag or folder`
          }
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

        {archive ? (
          <ArchivedList type={archivedType} search={search} onSelect={onOpenArchived} />
        ) : searching ? (
          <SearchResults
            search={found}
            onSelect={(hit) => onOpen({ type, id: hit.id, name: hit.name })}
          />
        ) : (
          <RankedList
            ranked={ranked}
            loading={results.isLoading || templates.isLoading}
            onSelect={(item) => onOpen({ type, id: item.id, name: item.name })}
            emptyText={`No ${plural} yet.`}
          />
        )}
      </Stack>
    </Panel>
  );
}
