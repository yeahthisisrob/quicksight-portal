/**
 * The state machine behind "point this definition at other datasets".
 *
 * One draft = targets per identifier, explicit column renames, mode and
 * name. Every change re-runs the server's dry run (debounced), and
 * `canApply` is the server's verdict, not the client's guess. The rebind
 * dialog and the Author page share this so there is exactly one place that
 * knows how a draft becomes a request.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { authoringApi, getApiErrorMessage } from '@/shared/api';
import type {
  ApplyRebindRequest,
  AuthorableAssetType,
  DefinitionDataset,
  DefinitionSource,
  Proposal,
  RebindPlan,
  RebindRequest,
} from '@/shared/api/modules/authoring';
import { useDebounce } from '@/shared/lib/useDebounce';

export interface DatasetOption {
  id: string;
  name: string;
}

export type RebindMode = ApplyRebindRequest['mode'];

export interface RebindSource {
  type: AuthorableAssetType;
  id: string;
  name: string;
}

export interface RebindDraft {
  source: RebindSource | null;
  loading: boolean;
  loadError: string | null;
  datasets: DefinitionDataset[];
  targets: Record<string, DatasetOption | null>;
  columnMaps: Record<string, Record<string, string>>;
  mode: RebindMode;
  name: string;
  plan: RebindPlan | null;
  planning: boolean;
  planError: string | null;
  /** The request body a plan, preview or apply would send. */
  rebinds: RebindRequest[];
  /** Server says every column resolves (or nothing needs resolving). */
  canApply: boolean;
  reload: () => Promise<void>;
  setTarget: (identifier: string, target: DatasetOption | null) => void;
  mapColumn: (identifier: string, source: string, target: string | null) => void;
  acceptSuggestions: (identifier: string) => void;
  setMode: (mode: RebindMode) => void;
  setName: (name: string) => void;
  /** Fill the draft from a planner proposal. Unclear proposals change nothing. */
  applyProposal: (proposal: Proposal) => void;
}

const PLAN_DEBOUNCE_MS = 400;

/**
 * `origin: 'archive'` reads a deleted asset's archived definition (the
 * Studio restoring it) instead of QuickSight.
 */
export function useRebindDraft(
  source: RebindSource | null,
  enabled = true,
  origin: DefinitionSource = 'live'
): RebindDraft {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DefinitionDataset[]>([]);
  const [targets, setTargets] = useState<Record<string, DatasetOption | null>>({});
  const [columnMaps, setColumnMaps] = useState<Record<string, Record<string, string>>>({});
  const [mode, setMode] = useState<RebindMode>('clone');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<RebindPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const sourceType = source?.type;
  const sourceId = source?.id;
  const sourceName = source?.name;

  const reload = useCallback(async () => {
    setPlan(null);
    setPlanError(null);
    setTargets({});
    setColumnMaps({});
    setMode('clone');
    setName(sourceName ? `${sourceName} (copy)` : '');
    setDatasets([]);
    setLoadError(null);
    if (!sourceType || !sourceId) {
      return;
    }
    setLoading(true);
    try {
      const result = await authoringApi.getDatasets(sourceType, sourceId, origin);
      setDatasets(result.datasets);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, `Failed to read the ${sourceType}`));
    } finally {
      setLoading(false);
    }
  }, [sourceType, sourceId, sourceName, origin]);

  useEffect(() => {
    if (enabled) {
      void reload();
    }
  }, [enabled, reload]);

  const rebinds = useMemo<RebindRequest[]>(
    () =>
      datasets
        .filter((d) => targets[d.identifier])
        .map((d) => ({
          identifier: d.identifier,
          targetDataSetId: targets[d.identifier]!.id,
          columnMap: columnMaps[d.identifier],
        })),
    [datasets, targets, columnMaps]
  );
  const rebindKey = useDebounce(JSON.stringify(rebinds), PLAN_DEBOUNCE_MS);

  useEffect(() => {
    if (!enabled || !sourceType || !sourceId) {
      return;
    }
    const current = JSON.parse(rebindKey) as RebindRequest[];
    if (current.length === 0) {
      setPlan(null);
      setPlanError(null);
      return;
    }
    let cancelled = false;
    setPlanning(true);
    setPlanError(null);
    authoringApi
      .planRebind(sourceType, sourceId, current, origin)
      .then((next) => {
        if (!cancelled) {
          setPlan(next);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPlan(null);
          setPlanError(getApiErrorMessage(error, 'Could not check the new dataset'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlanning(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rebindKey, enabled, sourceType, sourceId, origin]);

  const setTarget = useCallback((identifier: string, target: DatasetOption | null) => {
    setTargets((prev) => ({ ...prev, [identifier]: target }));
    // A different target makes the old renames meaningless.
    setColumnMaps((prev) => ({ ...prev, [identifier]: {} }));
  }, []);

  const mapColumn = useCallback((identifier: string, from: string, to: string | null) => {
    setColumnMaps((prev) => {
      const next = { ...(prev[identifier] ?? {}) };
      if (to) {
        next[from] = to;
      } else {
        delete next[from];
      }
      return { ...prev, [identifier]: next };
    });
  }, []);

  const acceptSuggestions = useCallback(
    (identifier: string) => {
      const dataset = plan?.datasets.find((d) => d.identifier === identifier);
      if (!dataset) {
        return;
      }
      setColumnMaps((prev) => {
        const next = { ...(prev[identifier] ?? {}) };
        for (const column of dataset.columns) {
          if (column.status === 'suggested' && column.suggestion) {
            next[column.name] = column.suggestion;
          }
        }
        return { ...prev, [identifier]: next };
      });
    },
    [plan]
  );

  const applyProposal = useCallback((proposal: Proposal) => {
    if (proposal.intent === 'unclear' || !proposal.plan) {
      return;
    }
    setMode(proposal.mode);
    if (proposal.name) {
      setName(proposal.name);
    }
    setTargets(
      Object.fromEntries(
        proposal.plan.datasets.map((d) => [
          d.identifier,
          { id: d.target.dataSetId, name: d.target.name },
        ])
      )
    );
    setColumnMaps(
      Object.fromEntries(proposal.rebinds.map((r) => [r.identifier, r.columnMap ?? {}]))
    );
  }, []);

  const trimmedName = name.trim();
  const canApply =
    !planning &&
    (rebinds.length === 0
      ? mode === 'clone'
        ? trimmedName.length > 0
        : trimmedName.length > 0 && trimmedName !== sourceName
      : Boolean(plan?.canApply) && (mode === 'update' || trimmedName.length > 0));

  return {
    source,
    loading,
    loadError,
    datasets,
    targets,
    columnMaps,
    mode,
    name,
    plan,
    planning,
    planError,
    rebinds,
    canApply,
    reload,
    setTarget,
    mapColumn,
    acceptSuggestions,
    setMode,
    setName,
    applyProposal,
  };
}
