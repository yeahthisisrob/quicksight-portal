/**
 * useStudio - the Studio editor's single source of truth.
 *
 * Composes the pure studio reducer (the asset open, the edits, the panel)
 * with the server calls an edit needs: the cached definition to draw, usage
 * and health, the repair plan with its fixes, the datasets the asset reads
 * (and which are SMUS-governed), the preview of the edited definition, and
 * the save. The asset lives in the URL (?type=&id=) so a row menu can
 * deep-link and a reload keeps its place.
 *
 * Nothing here asks a model. Generative work is the Assistant's.
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  buildWireframeModel,
  definitionFromExport,
  diffWireframeModels,
  type RebindDraft,
  type RebindMode,
  type RebindSource,
  useRebindDraft,
  type WireframeBadges,
  type WireframeDiff,
  type WireframeModel,
} from '@/entities/definition';
import { useSmusDatasetLinks, useSmusStatus } from '@/entities/smus';

import { assetsApi, authoringApi, getApiErrorMessage, tagsApi } from '@/shared/api';
import type {
  AssetInsights,
  DefinitionChange,
  DefinitionOp,
  DefinitionSource,
  RebindPlan,
  RepairFix,
  RepairPlan,
  SheetOutline,
} from '@/shared/api/modules/authoring';
import type { SmusDatasetLink } from '@/shared/api/modules/smus';
import { announceAssetChanges } from '@/shared/lib/assetChanges';
import { isTemplate, TEMPLATE_TAG } from '@/shared/lib/templateTag';
import { useDebounce } from '@/shared/lib/useDebounce';

import { healthBadges } from '../lib/insights';
import {
  defaultChoices,
  mergeRepairRebinds,
  type RepairChoices,
  type RepairSummary,
  repairRequests,
  repairSummary,
} from './repair';
import {
  initialStudioState,
  type SelectedElement,
  type StudioFolder,
  type StudioPanel,
  type StudioResult,
  type StudioState,
  studioReducer,
} from './studio';

interface SourceDefinition {
  loading: boolean;
  error: string | null;
  model: WireframeModel | null;
  tags: Array<{ key: string; value: string }>;
  isTemplate: boolean;
}

export interface SourceInsights {
  loading: boolean;
  error: string | null;
  data: AssetInsights | null;
}

interface EditedPreview {
  loading: boolean;
  error: string | null;
  plan: RebindPlan | null;
  model: WireframeModel | null;
  diff: WireframeDiff | null;
  /** Every change in plain language, as the server applied it. */
  changes: DefinitionChange[];
  /** The sheets with ids and positions, for the inspector. */
  outline: SheetOutline[] | null;
  warnings: string[];
}

/** The server's repair plan and what the person decided about each issue. */
interface SourceRepair {
  loading: boolean;
  error: string | null;
  plan: RepairPlan | null;
  /** issue id → accepted fix, or null to leave it. Unset means the proposal. */
  choices: RepairChoices;
  summary: RepairSummary;
  choose: (issueId: string, fix: RepairFix | null) => void;
  /** Accept every fix the server proposes: the auto-fix. */
  acceptAll: () => void;
}

/** One dataset the asset reads, and whether SMUS governs it. */
export interface StudioDataset {
  identifier: string;
  dataSetId: string;
  columns: number;
  calculatedFields: number;
  /** Undefined while SMUS is unconfigured or the links are loading. */
  smus?: SmusDatasetLink;
}

interface SourceData {
  loading: boolean;
  datasets: StudioDataset[];
  smusConfigured: boolean;
}

/** How to save: over the asset, as a named copy in a folder, or (archived) restored. */
interface SaveRequest {
  mode: RebindMode | 'restore';
  name?: string;
  /** Restore only: an id other than the archived one. */
  newAssetId?: string;
  folder?: StudioFolder | null;
}

/** What can come back from the archive: the editable kinds and the data they read. */
export type ArchivedType = RebindSource['type'] | 'dataset' | 'datasource';
export interface ArchivedPick {
  type: ArchivedType;
  id: string;
  name: string;
}

/** When, why and by whom an asset opened from the archive was archived. */
interface ArchivedFacts {
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
}

export interface Studio {
  state: StudioState;
  draft: RebindDraft;
  source: SourceDefinition;
  insights: SourceInsights;
  repair: SourceRepair;
  data: SourceData;
  /** Slow or failing visuals of the source, keyed by visual id. */
  healthBadges: WireframeBadges;
  preview: EditedPreview;
  /** Set when the open asset came from the archive. */
  archived: ArchivedFacts | null;
  open: (source: RebindSource | null, origin?: DefinitionSource) => void;
  /** Open something archived: a dashboard or analysis in the editor, data in its restore panel. */
  openArchived: (pick: ArchivedPick) => void;
  /** An archived dataset or data source being restored (from the URL). */
  archivedData: ArchivedPick | null;
  setPanel: (panel: StudioPanel) => void;
  addOps: (ops: DefinitionOp[]) => void;
  removeOp: (index: number) => void;
  undoOp: () => void;
  clearOps: () => void;
  selectElement: (element: SelectedElement | null) => void;
  /** Anything at all would be different in the written asset. */
  dirty: boolean;
  /** Every issue that blocks a write has been dealt with. */
  canSave: boolean;
  saving: boolean;
  saveError: string | null;
  save: (request: SaveRequest) => Promise<StudioResult | null>;
  dismissResult: () => void;
  /** Mark or unmark the open asset as a layout template. */
  setTemplate: (on: boolean) => Promise<void>;
}

const PREVIEW_DEBOUNCE_MS = 400;
const PREVIEW_STALE_MS = 60_000;
const REPAIR_PLAN_STALE_MS = 60_000;
const INSIGHTS_STALE_MS = 5 * 60_000;

function originFromParams(params: URLSearchParams): DefinitionSource {
  return params.get('source') === 'archive' ? 'archive' : 'live';
}

function sourceFromParams(params: URLSearchParams): RebindSource | null {
  const type = params.get('type');
  const id = params.get('id');
  if ((type === 'dashboard' || type === 'analysis') && id) {
    return { type, id, name: params.get('name') ?? id };
  }
  return null;
}

function archivedDataFromParams(params: URLSearchParams): ArchivedPick | null {
  const type = params.get('type');
  const id = params.get('id');
  if (params.get('source') === 'archive' && (type === 'dataset' || type === 'datasource') && id) {
    return { type, id, name: params.get('name') ?? id };
  }
  return null;
}

/** The export's list record carries the display name; fall back to the id. */
function nameFromExport(exportData: any, fallback: string): string {
  return exportData?.apiResponses?.list?.data?.Name ?? exportData?.Name ?? fallback;
}

function tagsFromExport(exportData: any): Array<{ key: string; value: string }> {
  const raw: any[] = exportData?.apiResponses?.tags?.data ?? exportData?.Tags ?? [];
  return raw
    .map((t) => ({ key: t.key ?? t.Key ?? '', value: t.value ?? t.Value ?? '' }))
    .filter((t) => t.key);
}

export interface StudioOptions {
  /** The asset to open when the URL carries none (stories, embedding). */
  initialSource?: RebindSource | null;
  initialOrigin?: DefinitionSource;
}

export function useStudio(options: StudioOptions = {}): Studio {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [state, dispatch] = useReducer(studioReducer, initialStudioState, (initial) => {
    const fromUrl = sourceFromParams(params);
    return {
      ...initial,
      source: fromUrl ?? options.initialSource ?? null,
      origin: fromUrl ? originFromParams(params) : (options.initialOrigin ?? 'live'),
    };
  });
  const source = state.source;
  const origin = state.origin;
  const fromArchive = origin === 'archive';
  const draft = useRebindDraft(source, true, origin);

  // --- the definition: the cached export, or the archived copy ---------------
  const sourceQuery = useQuery({
    queryKey: fromArchive
      ? ['archived-asset', source?.type, source?.id]
      : ['asset-json', source?.type, source?.id],
    queryFn: () =>
      fromArchive
        ? assetsApi.getArchivedAssetMetadata(source!.type, source!.id)
        : assetsApi.getCachedAsset(source!.type, source!.id),
    enabled: source !== null,
  });
  const archived = useMemo<ArchivedFacts | null>(() => {
    if (!fromArchive) return null;
    const meta = (sourceQuery.data as any)?.archivedMetadata ?? {};
    return {
      archivedAt: meta.archivedAt,
      archiveReason: meta.archiveReason,
      archivedBy: meta.archivedBy,
    };
  }, [fromArchive, sourceQuery.data]);
  const sourceDefinition = definitionFromExport(sourceQuery.data);
  const sourceModel = useMemo(
    () => (sourceDefinition ? buildWireframeModel(sourceDefinition) : null),
    [sourceDefinition]
  );
  const sourceTags = useMemo(() => tagsFromExport(sourceQuery.data), [sourceQuery.data]);

  // A deep link only carries the id; pick the name up from the export.
  useEffect(() => {
    if (!source || !sourceQuery.data) {
      return;
    }
    const name = nameFromExport(sourceQuery.data, source.id);
    if (name !== source.name) {
      dispatch({ type: 'open', source: { ...source, name }, origin });
    }
  }, [sourceQuery.data, source, origin]);

  // --- usage and health -------------------------------------------------------
  const insightsQuery = useQuery({
    queryKey: ['asset-insights', source?.type, source?.id],
    queryFn: () => authoringApi.getInsights(source!.type, source!.id),
    // An archived asset has no views or CloudWatch health to read.
    enabled: source !== null && !fromArchive,
    staleTime: INSIGHTS_STALE_MS,
    retry: false,
  });
  const badges = useMemo(() => healthBadges(insightsQuery.data), [insightsQuery.data]);

  // --- the datasets it reads, and which SMUS governs --------------------------
  const { data: smusStatus } = useSmusStatus();
  const smusConfigured = Boolean(smusStatus?.configured);
  const datasetIds = useMemo(() => draft.datasets.map((d) => d.dataSetId), [draft.datasets]);
  const { data: smusLinks } = useSmusDatasetLinks(datasetIds, smusConfigured);
  const datasets = useMemo<StudioDataset[]>(
    () =>
      draft.datasets.map((d) => ({
        identifier: d.identifier,
        dataSetId: d.dataSetId,
        columns: d.columns.length,
        calculatedFields: d.calculatedFields.length,
        smus: smusLinks?.get(d.dataSetId),
      })),
    [draft.datasets, smusLinks]
  );

  // --- issues and their fixes ---------------------------------------------------
  // Re-planned whenever a dataset is chosen for one that cannot be read, so
  // the chosen dataset's columns get checked too.
  const repairRebindsKey = JSON.stringify(
    draft.rebinds.map((r) => ({ identifier: r.identifier, targetDataSetId: r.targetDataSetId }))
  );
  const repairQuery = useQuery({
    queryKey: ['repair-plan', origin, source?.type, source?.id, repairRebindsKey],
    queryFn: () =>
      authoringApi.planRepair(
        source!.type,
        source!.id,
        { rebinds: JSON.parse(repairRebindsKey) },
        origin
      ),
    enabled: source !== null,
    staleTime: REPAIR_PLAN_STALE_MS,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const repairPlan = repairQuery.data ?? null;
  const [repairChoices, setRepairChoices] = useState<RepairChoices>({});
  const chooseFix = useCallback(
    (issueId: string, fix: RepairFix | null) =>
      setRepairChoices((prev) => ({ ...prev, [issueId]: fix })),
    []
  );
  const acceptAllFixes = useCallback(
    () => setRepairChoices(defaultChoices(repairPlan)),
    [repairPlan]
  );
  const repairRequest = useMemo(
    () => repairRequests(repairPlan, repairChoices),
    [repairPlan, repairChoices]
  );
  const summary = useMemo(
    () => repairSummary(repairPlan, repairChoices, draft.targets),
    [repairPlan, repairChoices, draft.targets]
  );
  // The rebinds preview and save send: a dataset chosen for one that cannot
  // be read, plus the column renames repairs make.
  const effectiveRebinds = useMemo(
    () => mergeRepairRebinds(draft.rebinds, draft.datasets, repairRequest.columnMaps),
    [draft.rebinds, draft.datasets, repairRequest.columnMaps]
  );
  const hasRepairs =
    repairRequest.repairs.length > 0 || Object.keys(repairRequest.columnMaps).length > 0;

  // --- edits ------------------------------------------------------------------
  const addOps = useCallback((ops: DefinitionOp[]) => dispatch({ type: 'addOps', ops }), []);
  const removeOp = useCallback((index: number) => dispatch({ type: 'removeOp', index }), []);
  const undoOp = useCallback(() => dispatch({ type: 'undoOp' }), []);
  const clearOps = useCallback(() => dispatch({ type: 'clearOps' }), []);
  const selectElement = useCallback(
    (element: SelectedElement | null) => dispatch({ type: 'selectElement', element }),
    []
  );
  const setPanel = useCallback((panel: StudioPanel) => dispatch({ type: 'setPanel', panel }), []);

  // --- the edited definition, drawn -------------------------------------------
  // Edits come in bursts (a nudge, another nudge); wait for the burst to end.
  const previewRequest = useMemo(
    () => ({
      rebinds: effectiveRebinds,
      ops: state.ops.length > 0 ? state.ops : undefined,
      repairs: repairRequest.repairs.length > 0 ? repairRequest.repairs : undefined,
    }),
    [effectiveRebinds, state.ops, repairRequest.repairs]
  );
  const previewKey = useDebounce(JSON.stringify(previewRequest), PREVIEW_DEBOUNCE_MS);
  const edited = effectiveRebinds.length > 0 || state.ops.length > 0 || hasRepairs;
  // Restoring is itself the write, so an archived asset can be saved untouched.
  const dirty = edited || fromArchive;
  const previewQuery = useQuery({
    queryKey: ['rebind-preview', origin, source?.type, source?.id, previewKey],
    queryFn: () =>
      authoringApi.previewRebind(source!.type, source!.id, JSON.parse(previewKey), origin),
    enabled: source !== null && edited,
    staleTime: PREVIEW_STALE_MS,
    placeholderData: keepPreviousData,
  });
  const previewData = edited ? previewQuery.data : undefined;
  const previewModel = useMemo(
    () => (previewData ? buildWireframeModel(previewData.definition) : null),
    [previewData]
  );
  const previewDiff = useMemo(
    () => (sourceModel && previewModel ? diffWireframeModels(sourceModel, previewModel) : null),
    [sourceModel, previewModel]
  );

  // --- save -------------------------------------------------------------------
  // A dataset still to choose blocks the write; so does a rebind whose
  // columns do not resolve.
  const canSave =
    source !== null &&
    !draft.planning &&
    summary.needsChoice === 0 &&
    (draft.rebinds.length === 0 || draft.canApply);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    async (request: SaveRequest): Promise<StudioResult | null> => {
      if (!source || !canSave) {
        return null;
      }
      const copy = request.mode === 'clone';
      const restoring = request.mode === 'restore';
      setSaving(true);
      setSaveError(null);
      try {
        const edits = {
          rebinds: effectiveRebinds,
          ops: state.ops.length > 0 ? state.ops : undefined,
          repairs: repairRequest.repairs.length > 0 ? repairRequest.repairs : undefined,
        };
        const written = restoring
          ? await authoringApi.restore(source.type, source.id, {
              ...edits,
              name: request.name?.trim() || undefined,
              newAssetId: request.newAssetId?.trim() || undefined,
              folderId: request.folder?.id,
            })
          : await authoringApi.applyRebind(source.type, source.id, {
              ...edits,
              mode: request.mode as RebindMode,
              name: copy ? request.name?.trim() || undefined : undefined,
              folderId: copy && request.folder ? request.folder.id : undefined,
            });
        const result: StudioResult = {
          assetType: written.assetType,
          assetId: written.assetId,
          name: written.name,
          mode: request.mode,
          versionNumber: written.versionNumber,
          folderIds: written.folderIds?.length
            ? written.folderIds
            : (copy || restoring) && request.folder
              ? [request.folder.id]
              : [],
          changes: written.changes,
          ...(written.warnings?.length ? { warnings: written.warnings } : {}),
        };
        dispatch({ type: 'saved', result });
        setRepairChoices({});
        // In place, the asset changed under the cached export and the plan.
        if (request.mode === 'update') {
          void queryClient.invalidateQueries({ queryKey: ['repair-plan', source.type, source.id] });
          void queryClient.invalidateQueries({ queryKey: ['asset-json', source.type, source.id] });
        }
        announceAssetChanges(
          result.folderIds.length > 0 ? [written.assetType, 'folder'] : [written.assetType]
        );
        enqueueSnackbar(
          restoring
            ? `Restored "${written.name}"`
            : copy
              ? `Created "${written.name}"`
              : `Saved "${written.name}"`,
          { variant: 'success' }
        );
        return result;
      } catch (error) {
        setSaveError(getApiErrorMessage(error, 'QuickSight rejected the change'));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      source,
      canSave,
      effectiveRebinds,
      state.ops,
      repairRequest.repairs,
      queryClient,
      enqueueSnackbar,
    ]
  );

  const open = useCallback(
    (next: RebindSource | null, nextOrigin: DefinitionSource = 'live') => {
      dispatch({ type: 'open', source: next, origin: nextOrigin });
      setRepairChoices({});
      setSaveError(null);
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          for (const key of ['type', 'id', 'name', 'source']) {
            copy.delete(key);
          }
          if (next) {
            copy.set('type', next.type);
            copy.set('id', next.id);
            copy.set('name', next.name);
            if (nextOrigin === 'archive') {
              copy.set('source', 'archive');
            }
          }
          return copy;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const openArchived = useCallback(
    (pick: ArchivedPick) => {
      if (pick.type === 'dashboard' || pick.type === 'analysis') {
        open({ type: pick.type, id: pick.id, name: pick.name }, 'archive');
        return;
      }
      setParams((prev) => {
        const copy = new URLSearchParams(prev);
        copy.set('source', 'archive');
        copy.set('type', pick.type);
        copy.set('id', pick.id);
        copy.set('name', pick.name);
        return copy;
      });
    },
    [open, setParams]
  );
  const archivedData = useMemo(() => archivedDataFromParams(params), [params]);

  const dismissResult = useCallback(() => dispatch({ type: 'dismissResult' }), []);

  const setTemplate = useCallback(
    async (on: boolean) => {
      if (!source || fromArchive) {
        return;
      }
      if (on) {
        await tagsApi.updateResourceTags(source.type, source.id, [TEMPLATE_TAG]);
      } else {
        await tagsApi.removeResourceTags(source.type, source.id, [TEMPLATE_TAG.key]);
      }
      // The cache now carries the new tag: the star, the template lists and
      // the tag filters follow.
      await queryClient.invalidateQueries({ queryKey: ['asset-json', source.type, source.id] });
      announceAssetChanges([source.type]);
      enqueueSnackbar(
        on ? `"${source.name}" is now a template` : `"${source.name}" is no longer a template`,
        { variant: 'success' }
      );
    },
    [source, fromArchive, queryClient, enqueueSnackbar]
  );

  return {
    state,
    draft,
    source: {
      loading: sourceQuery.isLoading,
      error: sourceQuery.error
        ? getApiErrorMessage(sourceQuery.error, 'Could not load the cached asset')
        : null,
      model: sourceModel,
      tags: sourceTags,
      isTemplate: isTemplate(sourceTags),
    },
    insights: {
      loading: insightsQuery.isLoading,
      error: insightsQuery.error
        ? getApiErrorMessage(insightsQuery.error, 'Could not load usage')
        : null,
      data: insightsQuery.data ?? null,
    },
    repair: {
      loading: repairQuery.isLoading,
      error: repairQuery.error
        ? getApiErrorMessage(repairQuery.error, 'Could not check the definition')
        : null,
      plan: repairPlan,
      choices: repairChoices,
      summary,
      choose: chooseFix,
      acceptAll: acceptAllFixes,
    },
    data: { loading: draft.loading, datasets, smusConfigured },
    healthBadges: badges,
    archived,
    preview: {
      loading: previewQuery.isFetching,
      error:
        edited && previewQuery.error
          ? getApiErrorMessage(previewQuery.error, 'Could not draw the edits')
          : null,
      plan: previewData?.plan ?? null,
      model: previewModel,
      diff: previewDiff,
      changes: previewData?.changes ?? [],
      outline: previewData?.outline ?? null,
      warnings: previewData?.warnings ?? [],
    },
    open,
    openArchived,
    archivedData,
    setPanel,
    addOps,
    removeOp,
    undoOp,
    clearOps,
    selectElement,
    dirty,
    canSave,
    saving,
    saveError,
    save,
    dismissResult,
    setTemplate,
  };
}
