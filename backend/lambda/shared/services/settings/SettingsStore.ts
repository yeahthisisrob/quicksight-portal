/**
 * SettingsStore - the portal's stored settings, one item per setting.
 *
 * Each key is its own item, so a save writes or deletes only the keys it
 * changes: two people saving different settings at once both land. Loaded
 * once per request (warmed by the API handler) and cached for a short while
 * in the Lambda container, so config readers can be synchronous. A failed
 * read is not fatal: the portal then runs from environment variables.
 */

import { logger } from '../../utils/logger';
import { portal } from '../store/portalTable';
import {
  buildSnapshot,
  effectiveValue,
  type SettingsSnapshot,
  type SettingValue,
  validateUpdate,
} from './settingsCatalog';

const CACHE_TTL_MS = 30_000;

interface Loaded {
  values: Record<string, SettingValue>;
  updatedAt?: string;
  updatedBy?: string;
}

const EMPTY: Loaded = { values: {} };

export class SettingsStore {
  private static instance: SettingsStore | null = null;

  public static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  /** Test hook. */
  public static reset(): void {
    SettingsStore.instance = null;
  }

  private loaded: Loaded = EMPTY;
  private loadedAt = 0;
  private inFlight: Promise<void> | null = null;

  public constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  /** Load (or refresh) the stored settings. Never throws; a failure means env-only. */
  public async load(force = false): Promise<void> {
    if (!force && this.loadedAt && Date.now() - this.loadedAt < CACHE_TTL_MS) {
      return;
    }
    if (this.inFlight) {
      return await this.inFlight;
    }
    this.inFlight = (async () => {
      try {
        const { data } = await portal().setting.query.byKey({}).go({ pages: 'all' });
        const latest = data.reduce<(typeof data)[number] | undefined>(
          (last, item) => (!last || item.updatedAt > last.updatedAt ? item : last),
          undefined
        );
        this.loaded = {
          values: Object.fromEntries(data.map((item) => [item.key, item.value as SettingValue])),
          ...(latest ? { updatedAt: latest.updatedAt, updatedBy: latest.updatedBy } : {}),
        };
      } catch (error) {
        logger.warn('Settings could not be read; running from environment only', { error });
      } finally {
        this.loadedAt = Date.now();
        this.inFlight = null;
      }
    })();
    return await this.inFlight;
  }

  /** Stored values as last loaded. Empty before the first load. */
  public stored(): Record<string, SettingValue> {
    return this.loaded.values;
  }

  /** Effective value of one key (stored -> env -> default). Sync; call load() first. */
  public get(key: string): SettingValue | undefined {
    return effectiveValue(key, this.stored(), this.env);
  }

  public getString(key: string): string {
    const value = this.get(key);
    return typeof value === 'string' ? value : '';
  }

  public getList(key: string): string[] {
    const value = this.get(key);
    return Array.isArray(value) ? value : [];
  }

  public snapshot(): SettingsSnapshot {
    return buildSnapshot(this.stored(), this.env, {
      updatedAt: this.loaded.updatedAt,
      updatedBy: this.loaded.updatedBy,
    });
  }

  /** Write each changed key as its own item. null, '' or [] clears a key. */
  public async save(values: Record<string, unknown>, updatedBy: string): Promise<SettingsSnapshot> {
    const validated = validateUpdate(values);
    const updatedAt = new Date().toISOString();
    const cleared = (value: unknown) =>
      value === null || value === '' || (Array.isArray(value) && value.length === 0);
    const entries = Object.entries(validated);
    const puts = entries
      .filter(([, value]) => !cleared(value))
      .map(([key, value]) => ({ key, value, updatedAt, updatedBy }));
    const deletes = entries.filter(([, value]) => cleared(value)).map(([key]) => ({ key }));
    if (puts.length) await portal().setting.put(puts).go();
    if (deletes.length) await portal().setting.delete(deletes).go();
    await this.load(true);
    logger.info('Settings saved', { keys: entries.map(([key]) => key), updatedBy });
    return this.snapshot();
  }
}

export const settingsStore = SettingsStore.getInstance();
