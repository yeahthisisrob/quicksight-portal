/**
 * Repair: the pure part. The server's repair plan lists issues, each with a
 * proposed fix and alternatives; the person accepts, swaps or declines each
 * one. This module turns those choices into what preview and apply send:
 * `repairs` (repair ops) and per-identifier column renames that ride on the
 * identifier's rebind.
 */
import type {
  DefinitionDataset,
  RebindRequest,
  RepairFix,
  RepairIssue,
  RepairOp,
  RepairPlan,
} from '@/shared/api/modules/authoring';

/** issue id → the accepted fix, or null for "leave as is". */
export type RepairChoices = Record<string, RepairFix | null>;

export const REPAIR_KIND_LABELS: Record<RepairIssue['kind'], string> = {
  'dataset-missing': 'Dataset cannot be read',
  'column-missing': 'Column not in the dataset',
  'parameter-missing': 'Parameter never declared',
  'quicksight-error': 'Reported by QuickSight',
};

export const REPAIR_KIND_ORDER: RepairIssue['kind'][] = [
  'dataset-missing',
  'column-missing',
  'parameter-missing',
  'quicksight-error',
];

/** Every issue starts on its proposed fix. */
export function defaultChoices(plan: RepairPlan | null | undefined): RepairChoices {
  const choices: RepairChoices = {};
  for (const issue of plan?.issues ?? []) {
    choices[issue.id] = issue.fix ?? null;
  }
  return choices;
}

/** The fix in force for an issue: the choice when one was made, else the proposal. */
export function chosenFix(issue: RepairIssue, choices: RepairChoices): RepairFix | null {
  return issue.id in choices ? choices[issue.id]! : (issue.fix ?? null);
}

/** Fixes a person can pick for an issue, proposed first. */
export function fixOptions(issue: RepairIssue): RepairFix[] {
  return [...(issue.fix ? [issue.fix] : []), ...issue.alternatives];
}

export function sameFix(a: RepairFix | null, b: RepairFix | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface RepairRequests {
  repairs: RepairOp[];
  /** identifier → { from: to } renames that resolve column issues. */
  columnMaps: Record<string, Record<string, string>>;
}

function isRepairOp(fix: RepairFix): fix is RepairOp {
  return fix.op === 'dropColumn' || fix.op === 'dropParameter' || fix.op === 'declareParameter';
}

/** What the accepted fixes send: repair ops, and renames grouped per identifier. */
export function repairRequests(
  plan: RepairPlan | null | undefined,
  choices: RepairChoices
): RepairRequests {
  const repairs: RepairOp[] = [];
  const columnMaps: Record<string, Record<string, string>> = {};
  for (const issue of plan?.issues ?? []) {
    const fix = chosenFix(issue, choices);
    if (!fix) {
      continue;
    }
    if (fix.op === 'rename' && fix.identifier && fix.columnName && fix.to) {
      columnMaps[fix.identifier] = { ...columnMaps[fix.identifier], [fix.columnName]: fix.to };
    } else if (isRepairOp(fix)) {
      repairs.push(fix);
    }
  }
  return { repairs, columnMaps };
}

/**
 * Fold repair renames into the draft's rebinds. An identifier that already
 * has a rebind gets the renames added to its column map; one without gets a
 * rebind to the dataset it reads today, so the rename can travel.
 */
export function mergeRepairRebinds(
  rebinds: RebindRequest[],
  datasets: DefinitionDataset[],
  columnMaps: RepairRequests['columnMaps']
): RebindRequest[] {
  const out = rebinds.map((r) =>
    columnMaps[r.identifier]
      ? { ...r, columnMap: { ...columnMaps[r.identifier], ...(r.columnMap ?? {}) } }
      : r
  );
  for (const [identifier, columnMap] of Object.entries(columnMaps)) {
    if (out.some((r) => r.identifier === identifier)) {
      continue;
    }
    const dataset = datasets.find((d) => d.identifier === identifier);
    if (dataset) {
      out.push({ identifier, targetDataSetId: dataset.dataSetId, columnMap });
    }
  }
  return out;
}

export interface RepairSummary {
  total: number;
  /** Issues with an accepted fix. */
  accepted: number;
  /** Issues left as they are (or that nothing can fix here). */
  left: number;
  /** Datasets that still need a target before the plan can be checked. */
  needsChoice: number;
}

export function repairSummary(
  plan: RepairPlan | null | undefined,
  choices: RepairChoices,
  targets: Record<string, unknown>
): RepairSummary {
  const issues = plan?.issues ?? [];
  let accepted = 0;
  let needsChoice = 0;
  for (const issue of issues) {
    if (issue.kind === 'dataset-missing') {
      if (issue.identifier && targets[issue.identifier]) {
        accepted += 1;
      } else {
        needsChoice += 1;
      }
    } else if (chosenFix(issue, choices)) {
      accepted += 1;
    }
  }
  return {
    total: issues.length,
    accepted,
    left: issues.length - accepted - needsChoice,
    needsChoice,
  };
}

/** Plain words for a fix, for the select and the publish summary. */
export function describeFix(fix: RepairFix | null): string {
  if (!fix) {
    return 'Leave as is';
  }
  switch (fix.op) {
    case 'rename':
      return `Rename to ${fix.to}`;
    case 'dropColumn':
      return 'Remove every reference to it';
    case 'dropParameter':
      return 'Remove the parameter and what reads it';
    case 'declareParameter':
      return `Declare it as ${fix.type ?? 'STRING'}${fix.defaultValue !== undefined ? ` defaulting to ${fix.defaultValue}` : ''}`;
    case 'rebind':
      return 'Choose a dataset';
    default:
      return String(fix.op);
  }
}
