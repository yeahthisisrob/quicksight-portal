/**
 * A repair plan: every reason QuickSight would refuse to write this
 * definition, each with a concrete fix when one can be computed. Two
 * sources, merged: our own check of the definition against the datasets it
 * declares (columns and parameters), and the errors QuickSight itself
 * reports on the asset. Nothing here writes; the client sends the fixes it
 * accepts to preview and apply as `repairs` and `rebinds`.
 */
import type { ColumnUsage, DefinitionDataset, RebindRequest } from '../types';
import { normalizeColumnName, type TargetColumn } from './columnResolution';
import { declaredParameters, type RepairOp, referencedParameters } from './definitionRepairs';

type RepairIssueKind =
  | 'dataset-missing'
  | 'column-missing'
  | 'parameter-missing'
  | 'quicksight-error';

type RepairFix =
  | RepairOp
  | { op: 'rename'; identifier: string; columnName: string; to: string }
  | { op: 'rebind'; identifier: string };

export interface RepairIssue {
  id: string;
  kind: RepairIssueKind;
  severity: 'error' | 'warning';
  message: string;
  identifier?: string;
  dataSetId?: string;
  columnName?: string;
  usage?: ColumnUsage;
  parameterName?: string;
  /** QuickSight's own error type and entity paths, when it reported this. */
  quickSight?: { type: string; message: string; paths: string[] };
  /** The fix the plan proposes; absent when the caller must choose or nothing can be done. */
  fix?: RepairFix;
  /** Other fixes that would also resolve it. */
  alternatives: RepairFix[];
}

export interface RepairPlan {
  issues: RepairIssue[];
  summary: { fixable: number; needsChoice: number; unfixable: number };
  /** The proposed fixes in request form, ready for preview/apply. */
  proposed: { repairs: RepairOp[]; rebinds: RebindRequest[] };
}

interface QuickSightError {
  Type?: string;
  Message?: string;
  ViolatedEntities?: Array<{ Path?: string }>;
}

export interface RepairTarget {
  dataSetId: string;
  name: string;
  columns: TargetColumn[];
}

interface BuildInput {
  definition: Record<string, any>;
  datasets: DefinitionDataset[];
  /** identifier -> the dataset it reads (after any rebind the caller chose), or null when it cannot be loaded. */
  targets: Map<string, RepairTarget | null>;
  quickSightErrors?: QuickSightError[];
}

const COLUMN_ERROR_TYPES = new Set([
  'COLUMN_NOT_FOUND',
  'COLUMN_TYPE_MISMATCH',
  'COLUMN_GEOGRAPHIC_ROLE_MISMATCH',
  'COLUMN_REPLACEMENT_MISSING',
]);
const DATASET_ERROR_TYPES = new Set(['DATA_SET_NOT_FOUND']);
const PARAMETER_ERROR_TYPES = new Set([
  'PARAMETER_NOT_FOUND',
  'PARAMETER_TYPE_INVALID',
  'PARAMETER_VALUE_INCOMPATIBLE',
]);

/** Single-quoted names in a QuickSight error message, in order. */
export function quotedNames(message: string): string[] {
  return [...message.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

function suggestFor(name: string, columns: TargetColumn[]): TargetColumn | undefined {
  const key = normalizeColumnName(name);
  const candidates = columns.filter((c) => normalizeColumnName(c.name) === key);
  return candidates.length === 1 ? candidates[0] : undefined;
}

function usageWords(usage: ColumnUsage): string {
  const parts: string[] = [];
  if (usage.visual) parts.push(`${usage.visual} visual${usage.visual === 1 ? '' : 's'}`);
  if (usage.filter) parts.push(`${usage.filter} filter${usage.filter === 1 ? '' : 's'}`);
  if (usage.calculatedField)
    parts.push(
      `${usage.calculatedField} calculated field${usage.calculatedField === 1 ? '' : 's'}`
    );
  if (usage.parameter)
    parts.push(`${usage.parameter} parameter default${usage.parameter === 1 ? '' : 's'}`);
  if (usage.control) parts.push(`${usage.control} control${usage.control === 1 ? '' : 's'}`);
  if (usage.other) parts.push(`${usage.other} other`);
  return parts.join(', ') || 'nothing visible';
}

export function buildRepairPlan(input: BuildInput): RepairPlan {
  const issues: RepairIssue[] = [];
  const columnIssues = new Map<string, RepairIssue>();

  // 1. Datasets and their columns.
  for (const dataset of input.datasets) {
    const target = input.targets.get(dataset.identifier) ?? null;
    if (!target) {
      issues.push({
        id: `dataset:${dataset.identifier}`,
        kind: 'dataset-missing',
        severity: 'error',
        message: `Dataset ${dataset.dataSetId} behind '${dataset.identifier}' cannot be read; choose a dataset for it to read instead.`,
        identifier: dataset.identifier,
        dataSetId: dataset.dataSetId,
        alternatives: [],
        fix: undefined,
      });
      continue;
    }
    const names = new Set(target.columns.map((c) => c.name));
    for (const column of dataset.columns) {
      if (names.has(column.name)) {
        continue;
      }
      const suggestion = suggestFor(column.name, target.columns);
      const drop: RepairFix = {
        op: 'dropColumn',
        identifier: dataset.identifier,
        columnName: column.name,
      };
      const rename: RepairFix | undefined = suggestion
        ? {
            op: 'rename',
            identifier: dataset.identifier,
            columnName: column.name,
            to: suggestion.name,
          }
        : undefined;
      const issue: RepairIssue = {
        id: `column:${dataset.identifier}:${column.name}`,
        kind: 'column-missing',
        severity: 'error',
        message: rename
          ? `Column ${column.name} is not in ${target.name}; ${suggestion!.name} looks like the same column. Used by ${usageWords(column.usage)}.`
          : `Column ${column.name} is not in ${target.name}. Used by ${usageWords(column.usage)}; removing it takes those references out.`,
        identifier: dataset.identifier,
        dataSetId: target.dataSetId,
        columnName: column.name,
        usage: column.usage,
        fix: rename ?? drop,
        alternatives: rename ? [drop] : [],
      };
      issues.push(issue);
      columnIssues.set(`${dataset.identifier}:${column.name}`, issue);
    }
  }

  // 2. Parameters referenced but never declared.
  const declared = new Set(declaredParameters(input.definition));
  for (const name of referencedParameters(input.definition)) {
    if (declared.has(name)) {
      continue;
    }
    issues.push({
      id: `parameter:${name}`,
      kind: 'parameter-missing',
      severity: 'error',
      message: `Parameter ${name} is used but never declared. Declaring it as a string keeps the controls and filters that read it.`,
      parameterName: name,
      fix: { op: 'declareParameter', name, type: 'STRING' },
      alternatives: [{ op: 'dropParameter', name }],
    });
  }

  // 3. QuickSight's own errors: attach to what we found, or report as-is.
  const byColumnName = new Map<string, RepairIssue[]>();
  for (const issue of columnIssues.values()) {
    byColumnName.set(issue.columnName!, [...(byColumnName.get(issue.columnName!) ?? []), issue]);
  }
  for (const error of input.quickSightErrors ?? []) {
    const type = error.Type ?? 'UNKNOWN';
    const message = error.Message ?? '';
    const paths = (error.ViolatedEntities ?? []).map((e) => e.Path).filter((p): p is string => !!p);
    const quickSight = { type, message, paths };
    const names = quotedNames(message);

    if (COLUMN_ERROR_TYPES.has(type)) {
      const matched = names.flatMap((n) => byColumnName.get(n) ?? []);
      if (matched.length > 0) {
        for (const issue of matched) {
          issue.quickSight = quickSight;
        }
        continue;
      }
    }
    if (DATASET_ERROR_TYPES.has(type)) {
      const matched = issues.find(
        (i) => i.kind === 'dataset-missing' && names.includes(i.dataSetId ?? '')
      );
      if (matched) {
        matched.quickSight = quickSight;
        continue;
      }
    }
    if (PARAMETER_ERROR_TYPES.has(type)) {
      const matched = issues.find(
        (i) => i.kind === 'parameter-missing' && names.includes(i.parameterName ?? '')
      );
      if (matched) {
        matched.quickSight = quickSight;
        continue;
      }
    }
    issues.push({
      id: `quicksight:${type}:${issues.length}`,
      kind: 'quicksight-error',
      severity: 'warning',
      message: message || `QuickSight reports ${type}`,
      quickSight,
      alternatives: [],
    });
  }

  // 4. Roll up and express the proposal as requests.
  const repairs: RepairOp[] = [];
  const columnMaps = new Map<string, Record<string, string>>();
  let fixable = 0;
  let needsChoice = 0;
  let unfixable = 0;
  for (const issue of issues) {
    if (issue.kind === 'dataset-missing') {
      needsChoice += 1;
      continue;
    }
    if (!issue.fix) {
      unfixable += 1;
      continue;
    }
    fixable += 1;
    if (issue.fix.op === 'rename') {
      const map = columnMaps.get(issue.fix.identifier) ?? {};
      map[issue.fix.columnName] = issue.fix.to;
      columnMaps.set(issue.fix.identifier, map);
    } else if (issue.fix.op !== 'rebind') {
      repairs.push(issue.fix);
    }
  }
  const rebinds: RebindRequest[] = [];
  for (const [identifier, columnMap] of columnMaps) {
    const target = input.targets.get(identifier);
    if (target) {
      rebinds.push({ identifier, targetDataSetId: target.dataSetId, columnMap });
    }
  }

  return { issues, summary: { fixable, needsChoice, unfixable }, proposed: { repairs, rebinds } };
}
