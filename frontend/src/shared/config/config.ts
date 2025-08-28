// Runtime-only configuration from window.APP_CONFIG
// Injected by CDK for production and local config.js for development

declare global {
  interface Window {
    APP_CONFIG: {
      API_URL: string;
      AWS_REGION: string;
      USER_POOL_ID: string;
      USER_POOL_CLIENT_ID: string;
      COGNITO_DOMAIN: string;
      ENVIRONMENT: string;
    };
  }
}

if (!window.APP_CONFIG) {
  throw new Error('APP_CONFIG not found. Make sure config.js is loaded before the application.');
}

export const config = window.APP_CONFIG;