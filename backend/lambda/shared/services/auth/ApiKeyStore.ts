/**
 * ApiKeyStore - long-lived credentials for machine callers (a CLI, a script,
 * an agent). A key is `qsp_` + 40 random url-safe characters; only its
 * SHA-256 is stored, so a leaked table cannot be replayed. Keys live in the
 * jobs table under one partition, like settings and the template library.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { TIME_UNITS } from '../../constants/timeConstants';
import { DynamoDBService } from '../aws/DynamoDBService';

export const API_KEY_PREFIX = 'qsp_';
const API_KEY_PK = 'API_KEY';
const SECRET_BYTES = 30;
const DISPLAY_PREFIX_LENGTH = 12;
const ID_LENGTH = 8;
/** lastUsedAt is written at most this often, so reads stay reads. */
const LAST_USED_WRITE_INTERVAL_MS = TIME_UNITS.HOUR;

interface ApiKey {
  id: string;
  label: string;
  /** The first characters of the secret, enough to recognise it in a config file. */
  prefix: string;
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
}

interface StoredApiKey extends ApiKey {
  pk: string;
  sk: string;
  hash: string;
}

export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function isApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

function toPublic(item: StoredApiKey): ApiKey {
  const { pk: _pk, sk: _sk, hash: _hash, ...key } = item;
  return key;
}

export class ApiKeyStore {
  private readonly tableName: string;

  public constructor(
    private readonly dynamo: DynamoDBService = new DynamoDBService(),
    tableName?: string,
    private readonly now: () => Date = () => new Date()
  ) {
    const env = process.env;
    this.tableName =
      tableName || env.JOBS_TABLE_NAME || `quicksight-portal-jobs-${env.AWS_ACCOUNT_ID || ''}`;
  }

  public async list(): Promise<ApiKey[]> {
    const items = await this.dynamo.queryPartition<StoredApiKey>(this.tableName, 'pk', API_KEY_PK);
    return items.map(toPublic).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** The secret is returned exactly once; it is not recoverable afterwards. */
  public async create(label: string, createdBy: string): Promise<{ key: ApiKey; secret: string }> {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new Error('A label is required');
    }
    const secret = `${API_KEY_PREFIX}${randomBytes(SECRET_BYTES).toString('base64url')}`;
    const item: StoredApiKey = {
      pk: API_KEY_PK,
      sk: randomUUID().slice(0, ID_LENGTH),
      id: '',
      label: trimmed,
      prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH),
      createdAt: this.now().toISOString(),
      createdBy,
      hash: hashApiKey(secret),
    };
    item.id = item.sk;
    await this.dynamo.putItem(this.tableName, item);
    return { key: toPublic(item), secret };
  }

  public async revoke(id: string): Promise<void> {
    await this.dynamo.deleteItem(this.tableName, { pk: API_KEY_PK, sk: id });
  }

  /** The key a secret belongs to, or null. Touches lastUsedAt at most hourly. */
  public async authenticate(secret: string): Promise<ApiKey | null> {
    if (!isApiKey(secret)) {
      return null;
    }
    const hash = hashApiKey(secret);
    const items = await this.dynamo.queryPartition<StoredApiKey>(this.tableName, 'pk', API_KEY_PK);
    const match = items.find((item) => item.hash === hash);
    if (!match) {
      return null;
    }
    const now = this.now();
    const lastUsed = match.lastUsedAt ? Date.parse(match.lastUsedAt) : 0;
    if (now.getTime() - lastUsed > LAST_USED_WRITE_INTERVAL_MS) {
      await this.dynamo
        .updateItem(
          this.tableName,
          { pk: API_KEY_PK, sk: match.sk },
          { set: { lastUsedAt: now.toISOString() } }
        )
        .catch(() => undefined);
    }
    return toPublic(match);
  }
}

export const apiKeyStore = new ApiKeyStore();
