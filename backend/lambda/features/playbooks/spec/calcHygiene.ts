/**
 * Keeping a dashboard's or analysis's calculated fields tidy: drop the ones
 * nothing reads, and give the rest the organisation's names. Both read what
 * uses each field from one place (`/calculated-fields`), both write through
 * the calculated-field ops (which follow every reference and refuse a drop
 * that is still read), and both dry-run the whole rewrite through the
 * rebind preview before anything is written.
 */
import type { PlaybookContext, PlaybookTarget } from '../types';
import { resolveText } from './inputs';
import type { StepPlan } from './steps';
import type { DropUnusedStep, RenameToStandardStep } from './types';

interface FieldUse {
  identifier: string;
  name: string;
  usage: Record<string, number>;
  readBy: string[];
  unused: boolean;
}

/** Prefixes a name may already carry, set aside before the standard one goes on. */
const KNOWN_PREFIXES = ['c_ds_', 'cds_', 'c_', 'calc_', 'cf_'];
const DEFAULT_PREFIX = 'c_';

const assetPath = (t: PlaybookTarget) =>
  `/api/authoring/${t.assetType}/${encodeURIComponent(t.assetId)}`;

async function fieldsOf(ctx: PlaybookContext, target: PlaybookTarget): Promise<FieldUse[]> {
  const data = await ctx.call<{ fields: FieldUse[] }>(
    'GET',
    `${assetPath(target)}/calculated-fields`
  );
  return data.fields ?? [];
}

/** The rewrite as QuickSight would be sent it: refused or unresolved means review. */
export async function dryRun(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  ops: unknown[]
): Promise<string | null> {
  try {
    const preview = await ctx.call<{ plan?: { canApply?: boolean } }>(
      'POST',
      `${assetPath(target)}/rebind/preview`,
      { rebinds: [], ops }
    );
    return preview.plan?.canApply === false ? 'The rewrite would not resolve every column' : null;
  } catch (error) {
    return `The rewrite was refused: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const readsOtherThanFields = (use: FieldUse) =>
  Object.entries(use.usage).some(([site, n]) => site !== 'calculatedField' && n > 0);

/**
 * Fields nothing reads, and fields read only by those (a chain of leftovers
 * goes together), in an order that drops each reader before what it reads.
 */
export function droppable(fields: FieldUse[]): FieldUse[] {
  const key = (f: { identifier: string; name: string }) => `${f.identifier}\u0000${f.name}`;
  const byKey = new Map(fields.map((f) => [key(f), f]));
  const dropped = new Set<string>();
  const order: FieldUse[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const field of fields) {
      const k = key(field);
      if (dropped.has(k) || readsOtherThanFields(field)) continue;
      const readers = field.readBy.map((name) => key({ identifier: field.identifier, name }));
      if (readers.every((r) => dropped.has(r) || !byKey.has(r))) {
        dropped.add(k);
        order.push(field);
        changed = true;
      }
    }
  }
  return order;
}

export async function planDropUnused(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  step: DropUnusedStep
): Promise<StepPlan> {
  if (target.assetType !== 'dashboard' && target.assetType !== 'analysis') {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: 'Applies to dashboards and analyses',
      changes: [],
    };
  }
  const leftovers = droppable(await fieldsOf(ctx, target));
  if (leftovers.length === 0) {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: 'Every calculated field is read',
      changes: [],
    };
  }
  const ops = leftovers.map((f) => ({
    op: 'dropCalculatedField',
    identifier: f.identifier,
    name: f.name,
  }));
  const changes = leftovers.map((f) => `Drop ${f.name}`);
  const refused = await dryRun(ctx, target, ops);
  if (refused) return { kind: step.kind, verdict: 'review', summary: refused, changes };
  return {
    kind: step.kind,
    verdict: 'change',
    summary: `${leftovers.length} calculated field${leftovers.length === 1 ? '' : 's'} nothing reads`,
    changes,
    data: { ops },
  };
}

/** "Order Margin %", "orderMargin", "calc_order-margin" -> "c_order_margin". */
export function standardName(name: string, prefix: string): string {
  const lower = name.toLowerCase();
  // The longest that fits: c_ds_revenue loses c_ds_, not just c_.
  const known = [prefix.toLowerCase(), ...KNOWN_PREFIXES]
    .filter((p) => p && lower.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  const rest = known ? name.slice(known.length) : name;
  const snake = rest
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/%/g, '_pct')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return `${prefix}${snake || 'field'}`;
}

export async function planRenameToStandard(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  step: RenameToStandardStep
): Promise<StepPlan> {
  if (target.assetType !== 'dashboard' && target.assetType !== 'analysis') {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: 'Applies to dashboards and analyses',
      changes: [],
    };
  }
  const prefix = resolveText(step.prefix, ctx.params) || DEFAULT_PREFIX;
  const fields = await fieldsOf(ctx, target);
  const taken = new Set(fields.map((f) => `${f.identifier}\u0000${f.name}`));
  const renames: Array<{ field: FieldUse; to: string }> = [];
  const clashes: string[] = [];
  for (const field of fields) {
    const to = standardName(field.name, prefix);
    if (to === field.name) continue;
    const key = `${field.identifier}\u0000${to}`;
    if (taken.has(key)) {
      clashes.push(`${field.name} → ${to}, a name already in use`);
      continue;
    }
    taken.add(key);
    renames.push({ field, to });
  }
  if (renames.length === 0 && clashes.length === 0) {
    return {
      kind: step.kind,
      verdict: 'skip',
      summary: `Every calculated field starts ${prefix}`,
      changes: [],
    };
  }
  if (renames.length === 0) {
    return { kind: step.kind, verdict: 'review', summary: clashes.join('; '), changes: [] };
  }
  const ops = renames.map(({ field, to }) => ({
    op: 'renameCalculatedField',
    identifier: field.identifier,
    name: field.name,
    to,
  }));
  const changes = renames.map(({ field, to }) => `Rename ${field.name} to ${to}`);
  const refused = await dryRun(ctx, target, ops);
  if (refused) return { kind: step.kind, verdict: 'review', summary: refused, changes };
  return {
    kind: step.kind,
    verdict: 'change',
    summary: `${renames.length} to rename${clashes.length ? `; left for review: ${clashes.join('; ')}` : ''}`,
    changes,
    data: { ops },
  };
}

/** Both write the same way: one update carrying the ops. */
export async function applyFieldOps(
  ctx: PlaybookContext,
  target: PlaybookTarget,
  plan: StepPlan,
  verb: string
): Promise<string> {
  const { ops } = plan.data as { ops: unknown[] };
  const result = await ctx.call<{ versionNumber?: number }>('POST', `${assetPath(target)}/rebind`, {
    mode: 'update',
    rebinds: [],
    ops,
  });
  return `${verb} ${ops.length} calculated field${ops.length === 1 ? '' : 's'}${result.versionNumber ? ` (version ${result.versionNumber})` : ''}`;
}
