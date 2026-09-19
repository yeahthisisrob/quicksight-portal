/**
 * SettingsStore - the portal's stored settings, one DynamoDB item.
 *
 * Lives in the jobs table (single-table, pk/sk) as { pk: 'SETTINGS', sk:
 * 'portal' } so no new infrastructure is needed. Loaded once per request
 * (warmed by the API handler) and cached for a short while in the Lambda
 * container, so config readers can be synchronous. A missing table or a
 * failed read is not fatal: the portal then runs from environment variables
 * exactly as it did before settings existed.
 */

import { logger } from '../../utils/logger';
import { DynamoDBService } from '../aws/DynamoDBService';
import {
  buildSnapshot,
  effectiveValue,
  type SettingsSnapshot,
  type SettingValue,
  validateUpdate,
} from './settingsCatalog';

const SETTINGS_PK = 'SETTINGS';
const SETTINGS_SK = 'portal';
const CACHE_TTL_MS = 30_000;

interface StoredItem {
  pk: string;
  sk: string;
  values: Record<string, SettingValue>;
  updatedAt?: string;
  updatedBy?: string;
}

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

  private readonly tableName: string;
  private item: StoredItem | null = null;
  private loadedAt = 0;
  private inFlight: Promise<void> | null = null;

  public constructor(
    private readonly dynamo: DynamoDBService = new DynamoDBService(),
    tableName?: string,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {
    this.tableName =
      tableName || env.JOBS_TABLE_NAME || `quicksight-portal-jobs-${env.AWS_ACCOUNT_ID || ''}`;
  }

  /** Load (or refresh) the stored item. Never throws; a failure means env-only. */
  public async load(force = false): Promise<void> {
    if (!force && this.loadedAt && Date.now() - this.loadedAt < CACHE_TTL_MS) {
      return;
    }
    if (this.inFlight) {
      return await this.inFlight;
    }
    this.inFlight = this.dynamo
      .getItem<StoredItem>(this.tableName, { pk: SETTINGS_PK, sk: SETTINGS_SK })
      .then((item) => {
        this.item = item;
      })
      .catch((error) => {
        logger.warn('Settings could not be read; running from environment only', { error });
        this.item = this.item ?? null;
      })
      .finally(() => {
        this.loadedAt = Date.now();
        this.inFlight = null;
      });
    return await this.inFlight;
  }

  /** Stored values as last loaded. Empty before the first load. */
  public stored(): Record<string, SettingValue> {
    return this.item?.values ?? {};
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
      updatedAt: this.item?.updatedAt,
      updatedBy: this.item?.updatedBy,
    });
  }

  /** Merge an update into the stored item. null clears a key. */
  public async save(values: Record<string, unknown>, updatedBy: string): Promise<SettingsSnapshot> {
    const validated = validateUpdate(values);
    await this.load(true);

    const next: Record<string, SettingValue> = { ...this.stored() };
    for (const [key, value] of Object.entries(validated)) {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }

    const item: StoredItem = {
      pk: SETTINGS_PK,
      sk: SETTINGS_SK,
      values: next,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    await this.dynamo.putItem(this.tableName, item);
    this.item = item;
    this.loadedAt = Date.now();
    logger.info('Settings saved', { keys: Object.keys(validated), updatedBy });
    return this.snapshot();
  }
}

export const settingsStore = SettingsStore.getInstance();
