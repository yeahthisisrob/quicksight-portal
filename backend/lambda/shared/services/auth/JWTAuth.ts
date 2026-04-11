import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';
import { type APIGatewayProxyEvent } from 'aws-lambda';

import { logger } from '../../utils/logger';

export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    email?: string;
    name?: string;
    groups?: string[];
  };
  error?: string;
}

/**
 * Lazily-built verifier. aws-jwt-verify caches the JWKS internally, so we
 * build this once per Lambda container and reuse it across invocations.
 *
 * Returns null if env vars are missing (e.g. misconfigured local SAM) — the
 * caller will treat that as an auth failure rather than crashing the Lambda.
 */
type Verifier = CognitoJwtVerifierSingleUserPool<{
  userPoolId: string;
  tokenUse: 'id';
  clientId: string;
}>;
let cachedVerifier: Verifier | null | undefined;

function getVerifier(): Verifier | null {
  if (cachedVerifier !== undefined) {
    return cachedVerifier;
  }

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID;

  if (!userPoolId || !clientId) {
    logger.warn(
      'JWTAuth not configured — missing COGNITO_USER_POOL_ID or COGNITO_USER_POOL_CLIENT_ID',
      {
        hasUserPoolId: Boolean(userPoolId),
        hasClientId: Boolean(clientId),
      }
    );
    cachedVerifier = null;
    return null;
  }

  cachedVerifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'id',
    clientId,
  });
  return cachedVerifier;
}

export class JWTAuth {
  /**
   * Verify the Bearer token on the request against the Cognito JWKS.
   * Checks signature, expiry, issuer, audience (client_id), and tokenUse=id.
   */
  public static async authenticate(event: APIGatewayProxyEvent): Promise<AuthResult> {
    const authHeader = event.headers.Authorization || event.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Missing authorization header' };
    }

    const idToken = authHeader.slice('Bearer '.length);

    const verifier = getVerifier();
    if (!verifier) {
      return { authenticated: false, error: 'Auth not configured' };
    }

    try {
      const payload = await verifier.verify(idToken);

      return {
        authenticated: true,
        user: {
          id: payload.sub,
          email: typeof payload.email === 'string' ? payload.email : undefined,
          name: typeof payload.name === 'string' ? payload.name : undefined,
          groups: Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [],
        },
      };
    } catch (error) {
      logger.warn('JWT verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }
}
