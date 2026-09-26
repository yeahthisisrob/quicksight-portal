/**
 * The gates every playbook has. Work in progress is left alone, an asset
 * can be opted out for good with a tag, a run can be narrowed to a tag, and
 * a first run can be a canary of a few assets.
 */
import { TIME_UNITS } from '../../../shared/constants';
import type { Gate, GateSpec, Playbook, ScopedTarget } from '../types';

/** Tag an asset with this and no playbook touches it. */
const OPT_OUT_TAG = 'portal:playbook-skip';

const DAY_MS = TIME_UNITS.DAY;

function tagged(target: ScopedTarget, wanted: string): boolean {
  const [key, value] = wanted.split('=').map((s) => s.trim());
  return (target.tags ?? target.entry?.tags ?? []).some(
    (t) => t.key === key && (value === undefined || value === '' || t.value === value)
  );
}

const COMMON_GATES: Gate[] = [
  {
    key: 'editedWithinDays',
    label: 'Skip anything edited in the last … days',
    kind: 'number',
    help: 'Recent edits are usually work in progress; leave them to whoever is making them.',
    exclude(target, value, now) {
      const days = Number(value);
      const when = target.lastUpdatedTime ?? target.entry?.lastUpdatedTime;
      const edited = when ? new Date(when).getTime() : Number.NaN;
      if (!(days > 0) || !Number.isFinite(edited)) return null;
      const ago = Math.floor((now - edited) / DAY_MS);
      return now - edited < days * DAY_MS
        ? `Edited ${ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`}; likely work in progress`
        : null;
    },
  },
  {
    key: 'onlyTagged',
    label: 'Only assets tagged',
    kind: 'text',
    help: 'key or key=value',
    exclude(target, value) {
      const wanted = String(value).trim();
      return wanted && !tagged(target, wanted) ? `Not tagged ${wanted}` : null;
    },
  },
];

/** A few assets first, to see it work before the rest. Applied after every other gate. */
const CANARY_GATE: GateSpec = {
  key: 'canary',
  label: 'Only the first … assets (a canary)',
  kind: 'number',
  help: 'The rest are listed as skipped; run again without it once the canary looks right.',
};

export function gatesOf(playbook: Playbook): GateSpec[] {
  return [...COMMON_GATES, ...(playbook.gates ?? []), CANARY_GATE].map(
    ({ key, label, kind, help, default: own }) => {
      const fallback = playbook.gateDefaults?.[key] ?? own;
      return {
        key,
        label,
        kind,
        ...(help ? { help } : {}),
        ...(fallback === undefined ? {} : { default: fallback }),
      };
    }
  );
}

export type GateValues = Record<string, number | string | boolean | null>;

/** Why each target is held back (absent: it goes ahead). */
export function applyGates(
  playbook: Playbook,
  targets: ScopedTarget[],
  values: GateValues,
  now: number
): Map<ScopedTarget, string> {
  const held = new Map<ScopedTarget, string>();
  const gates = [...COMMON_GATES, ...(playbook.gates ?? [])];
  for (const target of targets) {
    if (tagged(target, OPT_OUT_TAG)) {
      held.set(target, `Opted out (tagged ${OPT_OUT_TAG})`);
      continue;
    }
    for (const gate of gates) {
      const value =
        gate.key in values ? values[gate.key] : (playbook.gateDefaults?.[gate.key] ?? gate.default);
      if (value === null || value === undefined || value === '' || value === false) continue;
      const reason = gate.exclude(target, value, now);
      if (reason) {
        held.set(target, reason);
        break;
      }
    }
  }
  const canary = Number(
    CANARY_GATE.key in values ? values[CANARY_GATE.key] : playbook.gateDefaults?.[CANARY_GATE.key]
  );
  if (canary > 0) {
    let kept = 0;
    for (const target of targets) {
      if (held.has(target)) continue;
      kept++;
      if (kept > canary) held.set(target, `Beyond the canary of ${canary}`);
    }
  }
  return held;
}
