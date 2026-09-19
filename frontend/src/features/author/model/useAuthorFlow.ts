/**
 * useAuthorFlow - the Author page's single source of truth.
 *
 * Composes the pure flow reducer (which step, which source, the edits made,
 * what got published) with the shared rebind draft (targets, renames, the
 * server dry run) and the server calls that are specific to authoring: the
 * planner, insights, the mockup preview and the final apply. The source
 * lives in the URL (?type=&id=) so a row menu can deep-link and a reload
 * keeps its place.
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
  type RebindSource,
  useRebindDraft,
  type WireframeBadges,
  type WireframeDiff,
  type WireframeModel,
} from '@/entities/definition';

import { assetsApi, authoringApi, getApiErrorMessage, tagsApi } from '@/shared/api';
import type {
  AssetInsights,
  DefinitionChange,
  DefinitionOp,
  Proposal,
  RebindPlan,
  SheetOutline,
} from '@/shared/api/modules/authoring';
import type { CalculatedFieldTemplate } from '@/shared/api/modules/data-catalog';
import { useDebounce } from '@/shared/lib/useDebounce';

import { healthBadges } from '../lib/insights';
import {
  type AuthorFlowState,
  type AuthorFolder,
  type AuthorResult,
  type AuthorStep,
  authorFlowReducer,
  initialAuthorFlowState,
  nextStep,
  previousStep,
  type SelectedElement,
  type StepStatus,
  stepStatus,
} from './authorFlow';
import { isTemplate, TEMPLATE_TAG } from './templateTag';

export interface SourceDefinition {
  loading: boolean;
  error: string | null;
  /** The cached export, when there is one. */
  exportData: any;
  model: WireframeModel | null;
  tags: Array<{ key: string; value: string }>;
  isTemplate: boolean;
}

export interface SourceInsights {
  loading: boolean;
  error: string | null;
  data: AssetInsights | null;
}

export interface MockupPreview {
  loading: boolean;
  error: string | null;
  plan: RebindPlan | null;
  model: WireframeModel | null;
  diff: WireframeDiff | null;
  /** Every change in plain language, as the server applied it. */
  changes: DefinitionChange[];
  /** The resulting sheets with ids and positions, for the editor. */
  outline: SheetOutline[] | null;
}

export interface AuthorFlow {
  state: AuthorFlowState;
  status: Record<AuthorStep, StepStatus>;
  draft: RebindDraft;
  source: SourceDefinition;
  insights: SourceInsights;
  /** Slow or failing visuals of the source, keyed by visual id. */
  healthBadges: WireframeBadges;
  selectSource: (source: RebindSource | null) => void;
  goTo: (step: AuthorStep) => void;
  next: () => void;
  back: () => void;
  /** Mark or unmark any dashboard/analysis as a template. */
  setTemplate: (target: RebindSource, on: boolean) => Promise<void>;
  ask: string;
  setAsk: (ask: string) => void;
  proposing: boolean;
  proposal: Proposal | null;
  proposeError: string | null;
  propose: () => Promise<void>;
  preview: MockupPreview;
  /** Mockup editor: append edits, take them back. */
  addOps: (ops: DefinitionOp[]) => void;
  removeOp: (index: number) => void;
  undoOp: () => void;
  clearOps: () => void;
  selectElement: (element: SelectedElement | null) => void;
  /** Where a copy goes. */
  setFolder: (folder: AuthorFolder | null) => void;
  /** Calculated fields from the template library to add to the written definition. */
  addedFields: AddedTemplateField[];
  addTemplateField: (template: CalculatedFieldTemplate, identifier: string) => void;
  removeTemplateField: (templateId: string) => void;
  setTemplateFieldIdentifier: (templateId: string, identifier: string) => void;
  publishing: boolean;
  publishError: string | null;
  publish: () => Promise<void>;
  /** Start over with a different source. */
  reset: () => void;
  /** Start over with the asset just published as the source. */
  startFromResult: () => void;
}

export interface AddedTemplateField {
  templateId: string;
  identifier: string;
  name: string;
  expression: string;
}

const PREVIEW_DEBOUNCE_MS = 400;

function sourceFromParams(params: URLSearchParams): RebindSource | null {
  const type = params.get('type');
  const id = params.get('id');
  if ((type === 'dashboard' || type === 'analysis') && id) {
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

export interface AuthorFlowOptions {
  /** Where to start when the URL carries no source (stories, embedding). */
  initialSource?: RebindSource | null;
}

export function useAuthorFlow(options: AuthorFlowOptions = {}): AuthorFlow {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [state, dispatch] = useReducer(authorFlowReducer, initialAuthorFlowState, (initial) => ({
    ...initial,
    source: sourceFromParams(params) ?? options.initialSource ?? null,
  }));

  const draft = useRebindDraft(state.source);

  // --- source definition (cached export) -----------------------------------
  const sourceQuery = useQuery({
    queryKey: ['asset-json', state.source?.type, state.source?.id],
    queryFn: () => assetsApi.getCachedAsset(state.source!.type, state.source!.id),
    enabled: state.source !== null,
  });
  const sourceDefinition = definitionFromExport(sourceQuery.data);
  const sourceModel = useMemo(
    () => (sourceDefinition ? buildWireframeModel(sourceDefinition) : null),
    [sourceDefinition]
  );
  const sourceTags = useMemo(() => tagsFromExport(sourceQuery.data), [sourceQuery.data]);

  // A deep link only carries the id; pick the name up from the export.
  useEffect(() => {
    if (!state.source || !sourceQuery.data) {
      return;
    }
    const name = nameFromExport(sourceQuery.data, state.source.id);
    if (name !== state.source.name) {
      dispatch({ type: 'selectSource', source: { ...state.source, name } });
    }
  }, [sourceQuery.data, state.source]);

  // --- insights (views, health) ----------------------------------------------
  const insightsQuery = useQuery({
    queryKey: ['asset-insights', state.source?.type, state.source?.id],
    queryFn: () => authoringApi.getInsights(state.source!.type, state.source!.id),
    enabled: state.source !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const badges = useMemo(() => healthBadges(insightsQuery.data), [insightsQuery.data]);

  // --- template calculated fields ---------------------------------------------
  const [addedFields, setAddedFields] = useState<AddedTemplateField[]>([]);
  const addTemplateField = useCallback((template: CalculatedFieldTemplate, identifier: string) => {
    setAddedFields((prev) =>
      prev.some((f) => f.templateId === template.id)
        ? prev
        : [
            ...prev,
            {
              templateId: template.id,
              identifier,
              name: template.name,
              expression: template.expression,
            },
          ]
    );
  }, []);
  const removeTemplateField = useCallback((templateId: string) => {
    setAddedFields((prev) => prev.filter((f) => f.templateId !== templateId));
  }, []);
  const setTemplateFieldIdentifier = useCallback((templateId: string, identifier: string) => {
    setAddedFields((prev) =>
      prev.map((f) => (f.templateId === templateId ? { ...f, identifier } : f))
    );
  }, []);

  const selectSource = useCallback(
    (source: RebindSource | null) => {
      dispatch({ type: 'selectSource', source });
      setAddedFields([]);
      setParams(source ? { type: source.type, id: source.id, name: source.name } : {}, {
        replace: true,
      });
    },
    [setParams]
  );

  // --- edits (ops), folder, selection ----------------------------------------
  const addOps = useCallback((ops: DefinitionOp[]) => dispatch({ type: 'addOps', ops }), []);
  const removeOp = useCallback((index: number) => dispatch({ type: 'removeOp', index }), []);
  const undoOp = useCallback(() => dispatch({ type: 'undoOp' }), []);
  const clearOps = useCallback(() => dispatch({ type: 'clearOps' }), []);
  const selectElement = useCallback(
    (element: SelectedElement | null) => dispatch({ type: 'selectElement', element }),
    []
  );
  const setFolder = useCallback(
    (folder: AuthorFolder | null) => dispatch({ type: 'setFolder', folder }),
    []
  );

  // --- proposal --------------------------------------------------------------
  const [ask, setAsk] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const propose = useCallback(async () => {
    const source = state.source;
    if (!source || !ask.trim()) {
      return;
    }
    setProposing(true);
    setProposeError(null);
    setProposal(null);
    try {
      const result = await authoringApi.propose(source.type, source.id, { ask: ask.trim() });
      setProposal(result);
      draft.applyProposal(result);
      if (result.intent !== 'unclear' && result.ops.length > 0) {
        dispatch({ type: 'addOps', ops: result.ops });
      }
    } catch (error) {
      setProposeError(getApiErrorMessage(error, 'The planner could not build a proposal'));
    } finally {
      setProposing(false);
    }
  }, [state.source, ask, draft.applyProposal]);

  // --- mockup preview --------------------------------------------------------
  // Edits come in bursts (a nudge, another nudge); wait for the burst to end.
  const previewRequest = useMemo(
    () => ({
      rebinds: draft.rebinds,
      addCalculatedFields: addedFields.length > 0 ? addedFields : undefined,
      ops: state.ops.length > 0 ? state.ops : undefined,
    }),
    [draft.rebinds, addedFields, state.ops]
  );
  const previewKey = useDebounce(JSON.stringify(previewRequest), PREVIEW_DEBOUNCE_MS);
  const hasAnything = draft.rebinds.length > 0 || state.ops.length > 0 || addedFields.length > 0;
  const previewQuery = useQuery({
    queryKey: ['rebind-preview', state.source?.type, state.source?.id, previewKey],
    queryFn: () =>
      authoringApi.previewRebind(state.source!.type, state.source!.id, JSON.parse(previewKey)),
    enabled: state.step === 'mockup' && state.source !== null && hasAnything,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const previewModel = useMemo(
    () => (previewQuery.data ? buildWireframeModel(previewQuery.data.definition) : null),
    [previewQuery.data]
  );
  const previewDiff = useMemo(
    () => (sourceModel && previewModel ? diffWireframeModels(sourceModel, previewModel) : null),
    [sourceModel, previewModel]
  );

  // --- publish ---------------------------------------------------------------
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const publish = useCallback(async () => {
    const source = state.source;
    if (!source) {
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await authoringApi.applyRebind(source.type, source.id, {
        mode: draft.mode,
        rebinds: draft.rebinds,
        name: draft.name.trim() || undefined,
        addCalculatedFields: addedFields.length > 0 ? addedFields : undefined,
        ops: state.ops.length > 0 ? state.ops : undefined,
        folderId: draft.mode === 'clone' && state.folder ? state.folder.id : undefined,
      });
      const published: AuthorResult = {
        assetType: result.assetType,
        assetId: result.assetId,
        name: result.name,
        mode: draft.mode,
        versionNumber: result.versionNumber,
        folderId: result.folderId ?? (draft.mode === 'clone' ? state.folder?.id : undefined),
        changes: result.changes,
      };
      dispatch({ type: 'published', result: published });
      enqueueSnackbar(
        draft.mode === 'clone' ? `Created "${result.name}"` : `Updated "${result.name}"`,
        { variant: 'success' }
      );
    } catch (error) {
      setPublishError(getApiErrorMessage(error, 'QuickSight rejected the change'));
    } finally {
      setPublishing(false);
    }
  }, [
    state.source,
    state.ops,
    state.folder,
    draft.mode,
    draft.rebinds,
    draft.name,
    addedFields,
    enqueueSnackbar,
  ]);

  // --- templates -------------------------------------------------------------
  const setTemplate = useCallback(
    async (target: RebindSource, on: boolean) => {
      if (on) {
        await tagsApi.updateResourceTags(target.type, target.id, [TEMPLATE_TAG]);
      } else {
        await tagsApi.removeResourceTags(target.type, target.id, [TEMPLATE_TAG.key]);
      }
      // The export carries the tags; refresh it so the badge follows.
      await queryClient.invalidateQueries({ queryKey: ['asset-json', target.type, target.id] });
      enqueueSnackbar(
        on ? `"${target.name}" is now a template` : `"${target.name}" is no longer a template`,
        {
          variant: 'success',
        }
      );
    },
    [queryClient, enqueueSnackbar]
  );

  // --- navigation ------------------------------------------------------------
  const trimmedName = draft.name.trim();
  const renamed =
    draft.mode === 'clone'
      ? trimmedName.length > 0
      : trimmedName.length > 0 && trimmedName !== state.source?.name;
  // The draft only knows about rebinds; an in-place edit with no new
  // datasets is still applicable when there is something else to write.
  const editsOnly = draft.rebinds.length === 0 && (state.ops.length > 0 || addedFields.length > 0);
  const canApply =
    !draft.planning &&
    (editsOnly ? draft.mode === 'update' || trimmedName.length > 0 : draft.canApply);
  const status = stepStatus(state, {
    hasTargets: draft.rebinds.length > 0,
    canApply,
    hasOps: state.ops.length > 0,
    hasAddedFields: addedFields.length > 0,
    renamed,
  });
  const goTo = useCallback(
    (step: AuthorStep) => {
      if (status[step] !== 'locked') {
        dispatch({ type: 'goTo', step });
      }
    },
    [status]
  );
  const next = useCallback(() => {
    const step = nextStep(state.step);
    if (step) {
      goTo(step);
    }
  }, [state.step, goTo]);
  const back = useCallback(() => {
    const step = previousStep(state.step);
    if (step) {
      goTo(step);
    }
  }, [state.step, goTo]);

  const clearLocal = useCallback(() => {
    setAsk('');
    setProposal(null);
    setProposeError(null);
    setPublishError(null);
    setAddedFields([]);
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
    setParams({}, { replace: true });
    clearLocal();
  }, [setParams, clearLocal]);

  const startFromResult = useCallback(() => {
    const result = state.result;
    if (!result) {
      return;
    }
    clearLocal();
    selectSource({ type: result.assetType, id: result.assetId, name: result.name });
  }, [state.result, clearLocal, selectSource]);

  return {
    state,
    status,
    draft,
    source: {
      loading: sourceQuery.isLoading,
      error: sourceQuery.error
        ? getApiErrorMessage(sourceQuery.error, 'Could not load the cached asset')
        : null,
      exportData: sourceQuery.data,
      model: sourceModel,
      tags: sourceTags,
      isTemplate: isTemplate(sourceTags),
    },
    insights: {
      loading: insightsQuery.isLoading,
      error: insightsQuery.error
        ? getApiErrorMessage(insightsQuery.error, 'Could not load insights')
        : null,
      data: insightsQuery.data ?? null,
    },
    healthBadges: badges,
    selectSource,
    goTo,
    next,
    back,
    setTemplate,
    ask,
    setAsk,
    proposing,
    proposal,
    proposeError,
    propose,
    preview: {
      loading: previewQuery.isFetching,
      error: previewQuery.error
        ? getApiErrorMessage(previewQuery.error, 'Could not build the mockup')
        : null,
      plan: previewQuery.data?.plan ?? null,
      model: previewModel,
      diff: previewDiff,
      changes: previewQuery.data?.changes ?? [],
      outline: previewQuery.data?.outline ?? null,
    },
    addOps,
    removeOp,
    undoOp,
    clearOps,
    selectElement,
    setFolder,
    addedFields,
    addTemplateField,
    removeTemplateField,
    setTemplateFieldIdentifier,
    publishing,
    publishError,
    publish,
    reset,
    startFromResult,
  };
}
