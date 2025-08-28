import { type APIGatewayProxyEvent } from 'aws-lambda';

import { TIME_UNITS } from '../../constants';
import { logger } from '../../utils/logger';

// JWT token format constants
const JWT_CONSTANTS = {
  TOKEN_PARTS: 3, // Header, payload, signature
} as const;

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

export class JWTAuth {
  public static authenticate(event: APIGatewayProxyEvent): AuthResult {
    const authHeader = event.headers.Authorization || event.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Missing authorization header' };
    }

    const idToken = authHeader.replace('Bearer ', '');
    const tokenParts = idToken.split('.');

    if (tokenParts.length !== JWT_CONSTANTS.TOKEN_PARTS) {
      return { authenticated: false, error: 'Invalid token format' };
    }

    try {
      if (!tokenParts[1]) {
        return { authenticated: false, error: 'Invalid token format' };
      }
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());

      // Check token expiration
      if (payload.exp && payload.exp < Date.now() / TIME_UNITS.SECOND) {
        return { authenticated: false, error: 'Token expired' };
      }

      // Validate issuer if in production
      if (process.env.NODE_ENV === 'production' && process.env.COGNITO_ISSUER) {
        if (payload.iss !== process.env.COGNITO_ISSUER) {
          return { authenticated: false, error: 'Invalid token issuer' };
        }
      }

      return {
        authenticated: true,
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          groups: payload['cognito:groups'] || [],
        },
      };
    } catch (error) {
      logger.error('JWT validation error', { error });
      return { authenticated: false, error: 'Invalid token' };
    }
  }
}
