/**
 * The settings the portal exposes, and how each resolves.
 *
 * Resolution order is stored value -> environment variable -> default, and
 * every setting reports which one won. That order lets a deployment run from
 * env vars alone, then move values into the store one at a time without a
 * redeploy. Secrets are never stored: a sensitive setting is read-only and
 * only says whether its env var is set.
 *
 * Adding a setting means adding an entry here; the API and the settings page
 * render from this catalog, nothing is hard-coded elsewhere.
 */

export type SettingValue = string | boolean | string[];
export type SettingSource = 'stored' | 'env' | 'default';
export type SettingType = 'string' | 'select' | 'multiselect' | 'boolean';

export interface SettingSpec {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  envVar: string;
  default?: SettingValue;
  sensitive?: boolean;
  options?: Array<{ value: string; label: string }>;
  /** Endpoint the UI fetches live choices from (multiselect). */
  optionsFrom?: string;
}

export interface SettingGroupSpec {
  id: string;
  title: string;
  description: string;
  settings: SettingSpec[];
}

export interface ResolvedSetting extends Omit<SettingSpec, 'default'> {
  value?: SettingValue;
  source: SettingSource;
  sensitive: boolean;
}

export interface SettingsSnapshot {
  groups: Array<Omit<SettingGroupSpec, 'settings'> & { settings: ResolvedSetting[] }>;
  updatedAt?: string;
  updatedBy?: string;
}

export const SETTINGS_CATALOG: SettingGroupSpec[] = [
  {
    id: 'smus',
    title: 'SageMaker Unified Studio',
    description:
      'The SMUS (DataZone) domain the portal reads published assets from, and which of its projects count.',
    settings: [
      {
        key: 'smus.domainId',
        label: 'Domain id',
        description: 'The DataZone domain identifier (dzd_...). Unset disables the integration.',
        type: 'string',
        envVar: 'SMUS_DOMAIN_ID',
      },
      {
        key: 'smus.region',
        label: 'Domain region',
        description: 'Region of the domain. Defaults to the portal region.',
        type: 'string',
        envVar: 'SMUS_DOMAIN_REGION',
      },
      {
        key: 'smus.portalUrl',
        label: 'Portal URL',
        description:
          'Override for custom domains. Derived from the domain id and region when empty.',
        type: 'string',
        envVar: 'SMUS_PORTAL_URL',
      },
      {
        key: 'smus.projectIds',
        label: 'Projects to read from',
        description:
          'Only listings owned by these projects are offered as dataset targets. Empty means every project in the domain.',
        type: 'multiselect',
        envVar: 'SMUS_PROJECT_IDS',
        optionsFrom: '/settings/smus/projects',
      },
      {
        key: 'smus.databasePatterns',
        label: 'Database patterns',
        description:
          "Comma-separated glob patterns a listing's Glue database must match, e.g. published_* or gold-*. Use this when a published layer is a database-name convention rather than a project. Empty means any database.",
        type: 'string',
        envVar: 'SMUS_DATABASE_PATTERNS',
      },
    ],
  },
  {
    id: 'planner',
    title: 'Planner',
    description: 'The model behind "describe what you want". Bedrock in deployed environments.',
    settings: [
      {
        key: 'planner.provider',
        label: 'Provider',
        description:
          'The CLI providers only work on a developer machine and are ignored inside Lambda.',
        type: 'select',
        envVar: 'PLANNER_PROVIDER',
        default: 'bedrock',
        options: [
          { value: 'bedrock', label: 'Amazon Bedrock' },
          {
            value: 'openai-compatible',
            label: 'OpenAI-compatible endpoint (Grok, OpenAI, gateways)',
          },
          { value: 'claude-cli', label: 'Local Claude CLI (development only)' },
          { value: 'codex-cli', label: 'Local Codex CLI (development only)' },
        ],
      },
      {
        key: 'planner.modelId',
        label: 'Model id',
        description:
          "In the provider's own vocabulary, e.g. us.anthropic.claude-sonnet-4-6 or grok-4.",
        type: 'string',
        envVar: 'PLANNER_MODEL_ID',
      },
      {
        key: 'planner.region',
        label: 'Bedrock region',
        description: 'Defaults to the portal region.',
        type: 'string',
        envVar: 'PLANNER_REGION',
      },
      {
        key: 'planner.baseUrl',
        label: 'Endpoint base URL',
        description: 'OpenAI-compatible provider only, e.g. https://api.x.ai/v1.',
        type: 'string',
        envVar: 'PLANNER_BASE_URL',
      },
      {
        key: 'planner.apiKey',
        label: 'API key',
        description: 'OpenAI-compatible provider only. Secrets stay in the environment.',
        type: 'string',
        envVar: 'PLANNER_API_KEY',
        sensitive: true,
      },
    ],
  },
];

const SPECS_BY_KEY = new Map(SETTINGS_CATALOG.flatMap((g) => g.settings.map((s) => [s.key, s])));

export function settingSpec(key: string): SettingSpec | undefined {
  return SPECS_BY_KEY.get(key);
}

/** Env vars are strings; lists are comma-separated, booleans true/false. */
export function parseEnvValue(spec: SettingSpec, raw: string): SettingValue {
  switch (spec.type) {
    case 'multiselect':
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    case 'boolean':
      return raw.trim().toLowerCase() === 'true';
    default:
      return raw;
  }
}

function isEmpty(value: SettingValue | undefined): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Resolve one setting: stored value, else env, else default.
 * Sensitive settings never expose a value; they report whether the env var is set.
 */
export function resolveSetting(
  spec: SettingSpec,
  stored: Record<string, SettingValue | undefined>,
  env: NodeJS.ProcessEnv
): ResolvedSetting {
  const { default: defaultValue, ...rest } = spec;
  const base = { ...rest, sensitive: Boolean(spec.sensitive) };

  if (spec.sensitive) {
    return {
      ...base,
      value: Boolean(env[spec.envVar]),
      source: env[spec.envVar] ? 'env' : 'default',
    };
  }
  const storedValue = stored[spec.key];
  if (!isEmpty(storedValue)) {
    return { ...base, value: storedValue, source: 'stored' };
  }
  const raw = env[spec.envVar];
  if (raw !== undefined && raw !== '') {
    return { ...base, value: parseEnvValue(spec, raw), source: 'env' };
  }
  return { ...base, value: defaultValue, source: 'default' };
}

export function buildSnapshot(
  stored: Record<string, SettingValue | undefined>,
  env: NodeJS.ProcessEnv,
  meta: { updatedAt?: string; updatedBy?: string } = {}
): SettingsSnapshot {
  return {
    groups: SETTINGS_CATALOG.map((group) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      settings: group.settings.map((spec) => resolveSetting(spec, stored, env)),
    })),
    ...meta,
  };
}

/** The effective (non-sensitive) value of one key, for config readers. */
export function effectiveValue(
  key: string,
  stored: Record<string, SettingValue | undefined>,
  env: NodeJS.ProcessEnv
): SettingValue | undefined {
  const spec = settingSpec(key);
  if (!spec || spec.sensitive) {
    return undefined;
  }
  return resolveSetting(spec, stored, env).value;
}

/** Validate a proposed update against the catalog. Returns the normalised values. */
export function validateUpdate(
  values: Record<string, unknown>
): Record<string, SettingValue | null> {
  const out: Record<string, SettingValue | null> = {};
  for (const [key, raw] of Object.entries(values)) {
    const spec = settingSpec(key);
    if (!spec) {
      throw new Error(`Unknown setting '${key}'`);
    }
    if (spec.sensitive) {
      throw new Error(`'${key}' is a secret and can only be set through the environment`);
    }
    if (raw === null) {
      out[key] = null;
      continue;
    }
    switch (spec.type) {
      case 'string':
        if (typeof raw !== 'string') {
          throw new Error(`'${key}' must be a string`);
        }
        out[key] = raw.trim();
        break;
      case 'boolean':
        if (typeof raw !== 'boolean') {
          throw new Error(`'${key}' must be true or false`);
        }
        out[key] = raw;
        break;
      case 'select': {
        if (typeof raw !== 'string' || !spec.options?.some((o) => o.value === raw)) {
          throw new Error(
            `'${key}' must be one of: ${spec.options?.map((o) => o.value).join(', ')}`
          );
        }
        out[key] = raw;
        break;
      }
      case 'multiselect':
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) {
          throw new Error(`'${key}' must be a list of strings`);
        }
        out[key] = raw.map((v: string) => v.trim()).filter(Boolean);
        break;
    }
  }
  return out;
}
