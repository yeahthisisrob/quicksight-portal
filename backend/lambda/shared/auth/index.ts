import type { APIGatewayProxyEvent } from 'aws-lambda';

import { apiKeyStore, isApiKey } from '../services/auth/ApiKeyStore';
import { logger } from '../utils/logger';

export interface AuthContext {
  userId: string;
  accountId: string;
  email?: string;
  groups?: string[];
  /** Set when the caller authenticated with an API key rather than a user session. */
  apiKey?: { id: string; label: string };
}

/** Enough of a rejected key to recognise it in a log, never enough to use it. */
const LOGGED_PREFIX_LENGTH = 8;

/** Group name carried by API-key callers; key management itself needs a person. */
export const API_KEY_GROUP = 'api-key';

function bearerToken(event: APIGatewayProxyEvent): string | null {
  const header = event.headers?.Authorization || event.headers?.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

/**
 * Thrown by requireAuth when no valid auth context is present.
 * Top-level handlers catch this and return 401 (not 500).
 */
export class UnauthorizedError extends Error {
  public constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function getAuthContext(event: APIGatewayProxyEvent): Promise<AuthContext | null> {
  try {
    // API keys first: a CLI, a script or an agent calling the same endpoints.
    const token = bearerToken(event);
    if (token && isApiKey(token)) {
      const key = await apiKeyStore.authenticate(token);
      if (!key) {
        logger.warn('Unknown API key', {
          prefix: token.slice(0, LOGGED_PREFIX_LENGTH),
          path: event.path,
        });
        return null;
      }
      return {
        userId: `api-key:${key.label}`,
        accountId: process.env.AWS_ACCOUNT_ID || '',
        groups: [API_KEY_GROUP],
        apiKey: { id: key.id, label: key.label },
      };
    }

    // Then JWT Auth (both local SAM and production)
    const JWTAuthModule = await import('../services/auth/JWTAuth');
    const authResult = await JWTAuthModule.JWTAuth.authenticate(event);

    if (authResult.authenticated && authResult.user) {
      return {
        userId: authResult.user.id,
        accountId: process.env.AWS_ACCOUNT_ID || '',
        email: authResult.user.email,
        groups: authResult.user.groups || [],
      };
    }

    // Fallback to Cognito authorizer claims (production with API Gateway authorizer)
    const claims = event.requestContext?.authorizer?.claims;

    if (!claims) {
      logger.warn('No auth claims found in request', {
        jwtError: authResult.error,
        method: event.httpMethod,
        path: event.path,
      });
      return null;
    }

    return {
      userId: claims.sub,
      accountId: process.env.AWS_ACCOUNT_ID || '',
      email: claims.email,
      groups: claims['cognito:groups'] ? claims['cognito:groups'].split(',') : [],
    };
  } catch (error) {
    logger.error('Failed to extract auth context', { error });
    return null;
  }
}

export async function requireAuth(event: APIGatewayProxyEvent): Promise<AuthContext> {
  const authContext = await getAuthContext(event);

  if (!authContext) {
    throw new UnauthorizedError();
  }

  return authContext;
}

/** Like requireAuth, but only for a signed-in person: API keys cannot manage API keys. */
export async function requireUser(event: APIGatewayProxyEvent): Promise<AuthContext> {
  const context = await requireAuth(event);
  if (context.apiKey) {
    throw new ForbiddenError('This action needs a signed-in user, not an API key');
  }
  return context;
}

export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  public constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
