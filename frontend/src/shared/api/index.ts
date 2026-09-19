// Export all API modules (clean modular structure)

// Export shared utilities
export * from './client';
export * from './cognito';
export * from './errors';
export { activityApi } from './modules/activity';
export { assetsApi } from './modules/assets';
export { authoringApi } from './modules/authoring';
export { dataCatalogApi } from './modules/data-catalog';
export { deployApi } from './modules/deploy';
export { exportApi } from './modules/export';
export { foldersApi } from './modules/folders';
export { groupsApi } from './modules/groups';
export { ingestionsApi } from './modules/ingestions';
export { jobsApi } from './modules/jobs';
export { scriptsApi } from './modules/scripts';
export { semanticApi } from './modules/semantic';
export { settingsApi } from './modules/settings';
export { smusApi } from './modules/smus';
export { tagsApi } from './modules/tags';
export { usersApi } from './modules/users';
export * from './types';
