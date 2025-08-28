import { type RouteHandler } from '../../../api/types';
import { DeploymentHandler } from '../handlers/DeploymentHandler';

const deploymentHandler = new DeploymentHandler();

export const deploymentRoutes: RouteHandler[] = [
  // Deploy an asset
  {
    method: 'POST',
    path: '/deployments',
    handler: (event) => deploymentHandler.deployAsset(event),
  },

  // Validate deployment configuration
  {
    method: 'POST',
    path: '/deployments/validate',
    handler: (event) => deploymentHandler.validateDeployment(event),
  },

  // Get deployment history
  {
    method: 'GET',
    path: '/deployments/history',
    handler: (event) => deploymentHandler.getDeploymentHistory(event),
  },

  // Get deployment manifest templates
  {
    method: 'GET',
    path: '/deployments/templates',
    handler: (event) => deploymentHandler.getManifestTemplates(event),
  },

  // Get deployment job status
  {
    method: 'GET',
    path: /^\/deployments\/jobs\/([^/]+)$/,
    handler: (event) => deploymentHandler.getJobStatus(event),
  },

  // Stop a deployment job
  {
    method: 'POST',
    path: /^\/deployments\/jobs\/([^/]+)\/stop$/,
    handler: (event) => deploymentHandler.stopJob(event),
  },
];
