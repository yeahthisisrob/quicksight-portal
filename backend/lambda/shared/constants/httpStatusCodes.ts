/**
 * HTTP Status Code Constants
 * Centralizes all HTTP status codes used throughout the application
 */

// Success codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
} as const;

// Client error codes
export const HTTP_ERROR = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
} as const;

// Server error codes
export const HTTP_SERVER_ERROR = {
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Combined export for convenience
export const STATUS_CODES = {
  ...HTTP_STATUS,
  ...HTTP_ERROR,
  ...HTTP_SERVER_ERROR,
} as const;
