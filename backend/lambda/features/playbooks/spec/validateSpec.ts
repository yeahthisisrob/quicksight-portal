/**
 * A spec as it arrives (from the builder, the API or the Assistant),
 * checked before it is saved: known kinds only, every `{{placeholder}}` an
 * input it declares, steps in an order that can work.
 */
import { ValidationError } from '../../../shared/errors/ValidationError';
import type {
  PlaybookSpecInput,
  SelectableType,
  SpecCondition,
  SpecInput,
  SpecStep,
} from './types';

const NAME_MAX = 120;
const DESCRIPTION_MAX = 1000;
const MAX_INPUTS = 20;
const MAX_CONDITIONS = 20;
const MAX_STEPS = 10;
const KEY = /^[a-zA-Z][\w-]{0,40}$/;
const PLACEHOLDER = /^\{\{\s*([\w-]+)\s*\}\}$/;

const INPUT_KINDS = new Set<SpecInput['kind']>([
  'number',
  'text',
  'boolean',
  'datasource',
  'engine',
  'folder',
]);
const TYPES = new Set<SelectableType>(['dashboard', 'analysis', 'dataset', 'datasource']);
const CONDITION_FIELDS: Record<SpecCondition['kind'], string[]> = {
  views: ['min'],
  viewsAtMost: ['max'],
  tagged: ['tag'],
  nameContains: ['text'],
  hasErrors: [],
  readsEngine: ['engine'],
  readsGoverned: ['value'],
  sharedWith: ['principal'],
};
const STEP_FIELDS: Record<SpecStep['kind'], { required: string[]; optional: string[] }> = {
  matchDataset: { required: [], optional: ['engine', 'governed', 'infer', 'minConfidence'] },
  rebind: { required: [], optional: [] },
  tag: { required: ['target', 'key', 'value'], optional: [] },
  repair: { required: [], optional: [] },
  addToFolder: { required: ['folder'], optional: [] },
};
const TAG_TARGETS = new Set(['asset', 'replaced-datasets', 'replaced-datasources']);

function fail(message: string): never {
  throw new ValidationError(message);
}

function text(value: unknown, field: string, max: number, required = true): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`${field} is required`);
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length > max) {
    fail(`${field} must be text of at most ${max} characters`);
  }
  return value.trim();
}

/** A value that is a literal of the right kind, or a placeholder naming a declared input. */
function checkValue(value: unknown, where: string, inputs: Set<string>): void {
  if (typeof value === 'string') {
    const placeholder = PLACEHOLDER.exec(value);
    if (placeholder && !inputs.has(placeholder[1]!)) {
      fail(`${where} uses {{${placeholder[1]}}}, which is not one of the inputs`);
    }
    return;
  }
  if (typeof value !== 'number' && typeof value !== 'boolean') {
    fail(`${where} must be a value or an {{input}}`);
  }
}

function inputsOf(raw: unknown): SpecInput[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_INPUTS)
    fail(`inputs must be a list of at most ${MAX_INPUTS}`);
  const seen = new Set<string>();
  return raw.map((item, i) => {
    const input = (item ?? {}) as Record<string, unknown>;
    const key = String(input.key ?? '');
    if (!KEY.test(key)) fail(`inputs[${i}].key must be a short name (letters, digits, - or _)`);
    if (seen.has(key)) fail(`input '${key}' is declared twice`);
    seen.add(key);
    if (!INPUT_KINDS.has(input.kind as SpecInput['kind'])) {
      fail(`inputs[${i}].kind must be one of ${[...INPUT_KINDS].join(', ')}`);
    }
    return {
      key,
      label: text(input.label, `inputs[${i}].label`, NAME_MAX)!,
      kind: input.kind as SpecInput['kind'],
      ...(input.help ? { help: text(input.help, `inputs[${i}].help`, DESCRIPTION_MAX) } : {}),
      ...(input.required === true ? { required: true } : {}),
      ...(input.default === undefined
        ? {}
        : { default: input.default as string | number | boolean }),
    };
  });
}

export function validateSpec(raw: unknown): PlaybookSpecInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = text(body.name, 'name', NAME_MAX)!;
  const description = text(body.description, 'description', DESCRIPTION_MAX, false);
  const inputs = inputsOf(body.inputs);
  const declared = new Set(inputs.map((i) => i.key));

  const select = (body.select ?? {}) as Record<string, unknown>;
  const assetTypes = select.assetTypes as SelectableType[];
  if (
    !Array.isArray(assetTypes) ||
    assetTypes.length === 0 ||
    !assetTypes.every((t) => TYPES.has(t)) ||
    new Set(assetTypes).size !== assetTypes.length
  ) {
    fail(`select.assetTypes must list one or more of ${[...TYPES].join(', ')}`);
  }
  const where = (select.where ?? []) as unknown[];
  if (!Array.isArray(where) || where.length > MAX_CONDITIONS) {
    fail(`select.where must be a list of at most ${MAX_CONDITIONS} conditions`);
  }
  where.forEach((item, i) => {
    const condition = (item ?? {}) as Record<string, unknown>;
    const fields = CONDITION_FIELDS[condition.kind as SpecCondition['kind']];
    if (!fields)
      fail(`select.where[${i}].kind must be one of ${Object.keys(CONDITION_FIELDS).join(', ')}`);
    for (const field of fields)
      checkValue(condition[field], `select.where[${i}].${field}`, declared);
  });

  const steps = (body.steps ?? []) as unknown[];
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > MAX_STEPS) {
    fail(`steps must be a list of 1 to ${MAX_STEPS}`);
  }
  let matched = false;
  steps.forEach((item, i) => {
    const step = (item ?? {}) as Record<string, unknown>;
    const fields = STEP_FIELDS[step.kind as SpecStep['kind']];
    if (!fields) fail(`steps[${i}].kind must be one of ${Object.keys(STEP_FIELDS).join(', ')}`);
    for (const field of fields.required) checkValue(step[field], `steps[${i}].${field}`, declared);
    for (const field of fields.optional) {
      if (step[field] !== undefined) checkValue(step[field], `steps[${i}].${field}`, declared);
    }
    if (step.kind === 'tag' && !TAG_TARGETS.has(String(step.target))) {
      fail(`steps[${i}].target must be one of ${[...TAG_TARGETS].join(', ')}`);
    }
    if (step.kind === 'matchDataset') matched = true;
    const needsMatch =
      step.kind === 'rebind' ||
      (step.kind === 'tag' && String(step.target).startsWith('replaced-'));
    if (needsMatch && !matched) {
      fail(`steps[${i}] (${step.kind}) needs a matchDataset step before it`);
    }
  });

  const gates = body.gates;
  if (
    gates !== undefined &&
    (typeof gates !== 'object' || gates === null || Array.isArray(gates))
  ) {
    fail('gates must be an object of gate values');
  }

  return {
    name,
    ...(description ? { description } : {}),
    inputs,
    select: { assetTypes, where: where as SpecCondition[] },
    steps: steps as SpecStep[],
    ...(gates ? { gates: gates as Record<string, number | string | boolean> } : {}),
  };
}
