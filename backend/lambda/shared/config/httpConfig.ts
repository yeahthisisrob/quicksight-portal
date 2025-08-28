import { Agent } from 'https';

import { NodeHttpHandler } from '@smithy/node-http-handler';

/**
 * Create a single keep-alive agent for the entire Lambda container
 * This prevents socket exhaustion during long-running exports
 * Works for both AWS SDK v2 and v3
 */
const keepAliveAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50, // Limit concurrent connections
  maxFreeSockets: 10,
  timeout: 60000, // 60 second socket timeout
});

/**
 * Create HTTP handler with keep-alive enabled for SDK v3
 */
function createHttpHandler(): NodeHttpHandler {
  return new NodeHttpHandler({
    httpsAgent: keepAliveAgent,
    connectionTimeout: 60000, // 60 second connection timeout
    socketTimeout: 60000, // 60 second socket timeout
  });
}

/**
 * Get AWS SDK configuration with keep-alive enabled
 * Works for both SDK v2 (datasource list) and SDK v3 (everything else)
 */
export function getOptimizedAwsConfig(baseConfig: any = {}): any {
  return {
    ...baseConfig,
    requestHandler: createHttpHandler(),
    maxAttempts: 3, // Allow some retries for transient failures
  };
}
