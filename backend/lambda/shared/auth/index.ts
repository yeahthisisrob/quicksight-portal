import { type APIGatewayProxyEvent } from 'aws-lambda';

import { logger } from '../utils/logger';

export interface AuthContext {
  userId: string;
  accountId: string;
  email?: string;
  groups?: string[];
}

export async function getAuthContext(event: APIGatewayProxyEvent): Promise<AuthContext | null> {
  try {
    // First try to get from JWT Auth (both local SAM and production)
    const JWTAuthModule = await import('../services/auth/JWTAuth');
    const authResult = JWTAuthModule.JWTAuth.authenticate(event);

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
    throw new Error('Unauthorized');
  }

  return authContext;
}
