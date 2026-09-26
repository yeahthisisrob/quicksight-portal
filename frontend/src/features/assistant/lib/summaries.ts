/**
 * One-line summaries for the compact cards in the chat: what a wireframe
 * holds ("1 table · 2 bar charts · 2 filters in the control bar") and what
 * a plan will write ("1 KPI · 1 table · 1 filter in the control bar", or
 * "1 filter added · 2 visuals moved"). Pure, so they are tested directly.
 */
import type { components } from '@shared/generated/types';

import type { WireframeModel } from '@/entities/definition';

const MAX_TYPES = 3;

function plural(n: number, word: string): string {
  if (n === 1) return `1 ${word}`;
  return `${n} ${word.endsWith('s') ? word : `${word}s`}`;
}

/** "BarChart" -> "bar chart", "KPI" stays "KPI". */
function typeWords(type: string | undefined): string {
  if (!type) return 'visual';
  if (/^[A-Z]+$/.test(type)) return type;
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/** Counts in first-seen order, the biggest types first, the rest folded into "n more". */
function countsLine(types: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, MAX_TYPES).map(([type, n]) => plural(n, typeWords(type)));
  const rest = sorted.slice(MAX_TYPES).reduce((sum, [, n]) => sum + n, 0);
  return rest > 0 ? [...shown, `${rest} more`] : shown;
}

function filtersLine(n: number): string | null {
  return n > 0 ? `${plural(n, 'filter')} in the control bar` : null;
}

export function wireframeSummary(model: WireframeModel): string {
  const elements = model.sheets.flatMap((s) => s.elements);
  const visuals = elements.filter((e) => e.kind === 'visual').map((e) => e.visualType ?? '');
  const barControls = model.sheets.reduce((n, s) => n + s.controlBar.length, 0);
  const sheetControls = elements.filter(
    (e) => e.kind === 'filterControl' || e.kind === 'parameterControl'
  ).length;
  const parts = [
    model.sheets.length > 1 ? plural(model.sheets.length, 'sheet') : null,
    ...(visuals.length ? countsLine(visuals) : ['no visuals']),
    filtersLine(barControls),
    sheetControls > 0 ? `${plural(sheetControls, 'control')} on the sheet` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

const OP_WORDS: Record<string, string> = {
  move: 'moved',
  resize: 'resized',
  retype: 'retyped',
  retitle: 'retitled',
  remove: 'removed',
  duplicate: 'duplicated',
  renameSheet: 'sheet renamed',
  addFilter: 'filter added',
  addVisual: 'visual added',
  addAction: 'interaction added',
};

type PlanBuild = components['schemas']['AssistantPlanBuild'];

/** "2 filters in the control bar · 1 on the canvas". */
function filterPlacements(filters: Array<{ placement?: string }>): string[] {
  const onCanvas = filters.filter((f) => f.placement === 'canvas').length;
  const inBar = filters.length - onCanvas;
  return [
    filtersLine(inBar),
    onCanvas > 0 ? `${plural(onCanvas, 'filter')} on the canvas` : null,
  ].filter((p): p is string => Boolean(p));
}

/**
 * What a plan will write, from its `build`: a create lists the visuals,
 * filters and interactions; an edit counts its changes, rebinds and copy.
 * Undefined when there is no build or nothing to say.
 */
export function buildSummary(build: PlanBuild | undefined): string | undefined {
  if (build?.create) {
    const { visuals = [], filters = [], ask } = build.create;
    const actions = visuals.reduce((n, v) => n + (v.actions?.length ?? 0), 0);
    const parts = [
      ...(visuals.length
        ? countsLine(visuals.map((v) => v.type))
        : ask
          ? ['visuals proposed from the ask']
          : []),
      ...filterPlacements(filters),
      actions > 0 ? plural(actions, 'interaction') : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (build?.edit) {
    const { ops = [], rebinds = [], mode } = build.edit.request;
    const counts = new Map<string, number>();
    for (const { op } of ops) {
      const word = OP_WORDS[op] ?? 'changed';
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const parts = [
      mode === 'clone' ? 'a copy' : null,
      rebinds.length > 0 ? `${plural(rebinds.length, 'dataset')} swapped` : null,
      ...[...counts.entries()].map(([word, n]) =>
        word.includes(' ')
          ? `${n} ${n === 1 ? word : word.replace(/^(\w+)/, '$1s')}`
          : `${plural(n, 'element')} ${word}`
      ),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  }
  return undefined;
}
