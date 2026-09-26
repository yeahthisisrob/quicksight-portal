/**
 * Interactions on a visual (QuickSight custom actions): clicking a data
 * point filters other visuals on the sheet ("action filter", "click to
 * filter", "cross-filter"), or opens another sheet ("drill to", "navigate
 * to"). Pure: ids are resolved through functions the caller supplies, so
 * the rules are testable without a definition.
 */
import { randomUUID } from 'node:crypto';

export const ACTION_KINDS = ['filter', 'navigate'] as const;
export const ACTION_TRIGGERS = ['select', 'menu'] as const;

export interface VisualActionSpec {
  kind: (typeof ACTION_KINDS)[number];
  /** Shown in the visual's menu; derived from the kind when omitted. */
  name?: string;
  /** `select`: a click on a data point runs it. `menu`: it is offered in the data point's menu. Default select. */
  trigger?: (typeof ACTION_TRIGGERS)[number];
  /** filter: keys of the visuals it filters; every other visual on the sheet when omitted. */
  targets?: string[];
  /** filter: the columns the click filters by; every field of the visual when omitted. */
  fields?: string[];
  /** navigate: the name of the sheet it opens. */
  sheet?: string;
}

const ID_LENGTH = 8;
const TRIGGER = { select: 'DATA_POINT_CLICK', menu: 'DATA_POINT_MENU' } as const;

export interface ActionContext {
  /** The dataset identifier the visual reads, for `fields`. */
  identifier: string;
  /** The visual's key, for messages. */
  visual: string;
  visualIdOf: (key: string) => string | undefined;
  sheetIdOf: (name: string) => string | undefined;
}

/** The custom actions for one visual, or why each could not be built. */
export function buildActions(
  specs: VisualActionSpec[],
  ctx: ActionContext
): { actions: any[]; errors: string[] } {
  const actions: any[] = [];
  const errors: string[] = [];
  let clicks = 0;
  for (const spec of specs) {
    const trigger = spec.trigger ?? 'select';
    if (trigger === 'select' && ++clicks > 1) {
      errors.push(
        `'${ctx.visual}' has more than one action on select; a visual runs one on click, so make the others 'menu'.`
      );
      continue;
    }
    let operation: Record<string, any>;
    if (spec.kind === 'navigate') {
      const sheetId = spec.sheet ? ctx.sheetIdOf(spec.sheet) : undefined;
      if (!sheetId) {
        errors.push(
          `'${ctx.visual}' navigates to ${spec.sheet ? `sheet '${spec.sheet}', which does not exist` : 'no sheet'}; name a sheet of this asset.`
        );
        continue;
      }
      operation = {
        NavigationOperation: { LocalNavigationConfiguration: { TargetSheetId: sheetId } },
      };
    } else if (spec.kind === 'filter') {
      const targets = (spec.targets ?? []).map((k) => ({ key: k, id: ctx.visualIdOf(k) }));
      const unknown = targets.filter((t) => !t.id).map((t) => `'${t.key}'`);
      if (unknown.length > 0) {
        errors.push(`'${ctx.visual}' filters ${unknown.join(', ')}, not visuals on the sheet.`);
        continue;
      }
      operation = {
        FilterOperation: {
          SelectedFieldsConfiguration: spec.fields?.length
            ? {
                SelectedColumns: spec.fields.map((c) => ({
                  DataSetIdentifier: ctx.identifier,
                  ColumnName: c,
                })),
              }
            : { SelectedFieldOptions: 'ALL_FIELDS' },
          TargetVisualsConfiguration: {
            SameSheetTargetVisualConfiguration: targets.length
              ? { TargetVisuals: targets.map((t) => t.id as string) }
              : { TargetVisualOptions: 'ALL_VISUALS' },
          },
        },
      };
    } else {
      errors.push(`'${ctx.visual}': '${String(spec.kind)}' is not filter or navigate.`);
      continue;
    }
    actions.push({
      CustomActionId: `act-${randomUUID().replace(/-/g, '').slice(0, ID_LENGTH)}`,
      Name:
        spec.name?.trim() ||
        (spec.kind === 'filter' ? 'Filter on selection' : `Open ${spec.sheet}`),
      Status: 'ENABLED',
      Trigger: TRIGGER[trigger],
      ActionOperations: [operation],
    });
  }
  return { actions, errors };
}
