/**
 * useAuthorFlow - the Author page's single source of truth.
 *
 * Composes the pure flow reducer (which step, which source, what got
 * published) with the shared rebind draft (targets, renames, the server dry
 * run) and the three server calls that are specific to authoring: the
 * planner, the mockup preview and the final apply. The source lives in the
 * URL (?type=&id=) so a row menu can deep-link and a reload keeps its place.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  type WireframeDiff,
  type WireframeModel,
} from '@/entities/definition';

import { assetsApi, authoringApi, getApiErrorMessage, tagsApi } from '@/shared/api';
import type { Proposal, RebindPlan } from '@/shared/api/modules/authoring';
import type { CalculatedFieldTemplate } from '@/shared/api/modules/data-catalog';

import {
  type AuthorFlowState,
  type AuthorResult,
  type AuthorStep,
  authorFlowReducer,
  initialAuthorFlowState,
  nextStep,
  previousStep,
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

export interface MockupPreview {
  loading: boolean;
  error: string | null;
  plan: RebindPlan | null;
  model: WireframeModel | null;
  diff: WireframeDiff | null;
}

export interface AuthorFlow {
  state: AuthorFlowState;
  status: Record<AuthorStep, StepStatus>;
  draft: RebindDraft;
  source: SourceDefinition;
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
}

export interface AddedTemplateField {
  templateId: string;
  identifier: string;
  name: string;
  expression: string;
}

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
    } catch (error) {
      setProposeError(getApiErrorMessage(error, 'The planner could not build a proposal'));
    } finally {
      setProposing(false);
    }
  }, [state.source, ask, draft.applyProposal]);

  // --- mockup preview --------------------------------------------------------
  const rebindKey = JSON.stringify(draft.rebinds);
  const previewQuery = useQuery({
    queryKey: ['rebind-preview', state.source?.type, state.source?.id, rebindKey],
    queryFn: () => authoringApi.previewRebind(state.source!.type, state.source!.id, draft.rebinds),
    enabled: state.step === 'mockup' && state.source !== null && draft.rebinds.length > 0,
    staleTime: 60_000,
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
      });
      const published: AuthorResult = {
        assetType: result.assetType,
        assetId: result.assetId,
        name: result.name,
        mode: draft.mode,
        versionNumber: result.versionNumber,
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
  }, [state.source, draft.mode, draft.rebinds, draft.name, addedFields, enqueueSnackbar]);

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
  const status = stepStatus(state, {
    hasTargets: draft.rebinds.length > 0,
    canApply: draft.canApply && !draft.planning,
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

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
    setParams({}, { replace: true });
    setAsk('');
    setProposal(null);
    setProposeError(null);
    setPublishError(null);
    setAddedFields([]);
  }, [setParams]);

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
    },
    addedFields,
    addTemplateField,
    removeTemplateField,
    setTemplateFieldIdentifier,
    publishing,
    publishError,
    publish,
    reset,
  };
}
