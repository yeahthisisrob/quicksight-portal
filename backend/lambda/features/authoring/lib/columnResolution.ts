/**
 * Does a target dataset satisfy what a definition reads from its current one?
 *
 * Pure. Given the referenced columns, the target's output columns and the
 * caller's explicit renames, each referenced column resolves to exactly one
 * status. Nothing is guessed silently: a near match is *suggested*, and only
 * becomes a rename when the caller puts it in the column map. That keeps the
 * plan deterministic and leaves the fuzzy judgement to a human, or to a
 * planner that has to state its choices in the map where they can be read.
 */

import type { ColumnResolution, ColumnResolutionStatus, ReferencedColumn } from '../types';

export interface TargetColumn {
  name: string;
  type?: string;
}

interface ColumnResolutionResult {
  columns: ColumnResolution[];
  unusedTargetColumns: string[];
  summary: Record<ColumnResolutionStatus, number>;
  canApply: boolean;
}

/** Case, whitespace and separator insensitive: `Order Date` ~ `order_date`. */
export function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function emptySummary(): Record<ColumnResolutionStatus, number> {
  return { matched: 0, mapped: 0, suggested: 0, missing: 0 };
}

export function resolveColumns(
  referenced: ReferencedColumn[],
  target: TargetColumn[],
  columnMap: Record<string, string> = {}
): ColumnResolutionResult {
  const byName = new Map(target.map((c) => [c.name, c]));
  const byNormalized = new Map<string, TargetColumn[]>();
  for (const column of target) {
    const key = normalizeColumnName(column.name);
    byNormalized.set(key, [...(byNormalized.get(key) ?? []), column]);
  }

  /** A near match is only offered when it is unambiguous. */
  const suggestFor = (name: string): TargetColumn | undefined => {
    const candidates = byNormalized.get(normalizeColumnName(name)) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  };

  const used = new Set<string>();
  const summary = emptySummary();

  const columns: ColumnResolution[] = referenced.map((ref) => {
    const mappedName = columnMap[ref.name];
    let resolution: ColumnResolution;

    if (mappedName !== undefined) {
      const hit = byName.get(mappedName);
      resolution = hit
        ? {
            name: ref.name,
            status: 'mapped',
            resolvedTo: hit.name,
            targetType: hit.type,
            usage: ref.usage,
          }
        : {
            name: ref.name,
            status: 'missing',
            suggestion: suggestFor(mappedName)?.name ?? suggestFor(ref.name)?.name,
            usage: ref.usage,
          };
    } else {
      const exact = byName.get(ref.name);
      if (exact) {
        resolution = {
          name: ref.name,
          status: 'matched',
          resolvedTo: exact.name,
          targetType: exact.type,
          usage: ref.usage,
        };
      } else {
        const near = suggestFor(ref.name);
        resolution = near
          ? {
              name: ref.name,
              status: 'suggested',
              suggestion: near.name,
              targetType: near.type,
              usage: ref.usage,
            }
          : { name: ref.name, status: 'missing', usage: ref.usage };
      }
    }

    if (resolution.resolvedTo) {
      used.add(resolution.resolvedTo);
    }
    summary[resolution.status] += 1;
    return resolution;
  });

  return {
    columns,
    unusedTargetColumns: target.map((c) => c.name).filter((name) => !used.has(name)),
    summary,
    canApply: summary.suggested === 0 && summary.missing === 0,
  };
}
