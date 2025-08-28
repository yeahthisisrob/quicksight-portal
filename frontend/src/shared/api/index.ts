// Export all API modules (clean modular structure)
export { assetsApi } from './modules/assets';
export { exportApi } from './modules/export';
export { dataCatalogApi } from './modules/data-catalog';
export { usersApi } from './modules/users';
export { groupsApi } from './modules/groups';
export { tagsApi } from './modules/tags';
export { foldersApi } from './modules/folders';
export { semanticApi } from './modules/semantic';
export { activityApi } from './modules/activity';
export { scriptsApi } from './modules/scripts';
export { ingestionsApi } from './modules/ingestions';
export { deployApi } from './modules/deploy';
export { jobsApi } from './modules/jobs';

// Export shared utilities
export * from './client';
export * from './cognito';
export * from './types';
export { requestManager } from './requestManager';