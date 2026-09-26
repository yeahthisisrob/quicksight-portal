import { client, unwrap } from '../typed';

/** Automation scripts, like demo cleanup. */
export const scriptsApi = {
  async previewDemoCleanup() {
    return unwrap(
      await client.GET('/api/scripts/demo-cleanup/preview'),
      'Failed to preview demo cleanup'
    );
  },

  async executeDemoCleanup() {
    return unwrap(
      await client.POST('/api/scripts/demo-cleanup/execute'),
      'Failed to execute demo cleanup'
    );
  },
};
