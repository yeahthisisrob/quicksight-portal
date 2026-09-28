/**
 * ApiKeyStore - long-lived credentials for machine callers (a CLI, a script,
 * an agent). A key is `qsp_` + 40 random url-safe characters; only its
 * SHA-256 is stored, so a leaked table cannot be replayed. Keys live in the
 * portal table, one item per key.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { TIME_UNITS } from '../../constants/timeConstants';
import { portal } from '../store/portalTable';

export const API_KEY_PREFIX = 'qsp_';
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

export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function isApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

function toPublic({ hash: _hash, ...key }: ApiKey & { hash: string }): ApiKey {
  return key;
}

export class ApiKeyStore {
  public constructor(private readonly now: () => Date = () => new Date()) {}

  private async all(): Promise<Array<ApiKey & { hash: string }>> {
    return (await portal().apiKey.query.byId({}).go({ pages: 'all' })).data;
  }

  public async list(): Promise<ApiKey[]> {
    return (await this.all()).map(toPublic).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** The secret is returned exactly once; it is not recoverable afterwards. */
  public async create(label: string, createdBy: string): Promise<{ key: ApiKey; secret: string }> {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new Error('A label is required');
    }
    const secret = `${API_KEY_PREFIX}${randomBytes(SECRET_BYTES).toString('base64url')}`;
    const item = {
      id: randomUUID().slice(0, ID_LENGTH),
      label: trimmed,
      prefix: secret.slice(0, DISPLAY_PREFIX_LENGTH),
      createdAt: this.now().toISOString(),
      createdBy,
      hash: hashApiKey(secret),
    };
    await portal().apiKey.create(item).go();
    return { key: toPublic(item), secret };
  }

  /** Whether the key is still there (revoking deletes it). */
  public async exists(id: string): Promise<boolean> {
    return (await portal().apiKey.get({ id }).go()).data !== null;
  }

  public async revoke(id: string): Promise<void> {
    await portal().apiKey.delete({ id }).go();
  }

  /** The key a secret belongs to, or null. Touches lastUsedAt at most hourly. */
  public async authenticate(secret: string): Promise<ApiKey | null> {
    if (!isApiKey(secret)) {
      return null;
    }
    const hash = hashApiKey(secret);
    const match = (await this.all()).find((item) => item.hash === hash);
    if (!match) {
      return null;
    }
    const now = this.now();
    const lastUsed = match.lastUsedAt ? Date.parse(match.lastUsedAt) : 0;
    if (now.getTime() - lastUsed > LAST_USED_WRITE_INTERVAL_MS) {
      await portal()
        .apiKey.patch({ id: match.id })
        .set({ lastUsedAt: now.toISOString() })
        .go()
        .catch(() => undefined);
    }
    return toPublic(match);
  }
}

export const apiKeyStore = new ApiKeyStore();
