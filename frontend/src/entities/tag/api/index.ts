import { api } from '@/shared/api';

import type { Tag } from '../model';

export const tagApi = {
  // Get tags for a resource
  getResourceTags: (resourceType: string, resourceId: string) => 
    api.get(`/tags/${resourceType}/${resourceId}`),

  // Update tags for a resource
  updateResourceTags: (resourceType: string, resourceId: string, tags: Tag[]) => 
    api.put(`/tags/${resourceType}/${resourceId}`, { tags }),

  // Get tags for multiple resources
  getBatchTags: (resources: Array<{ type: string; id: string }>) => 
    api.post('/tags/batch', { resources }),

  // Get all unique tag keys across resources
  getTagKeys: () => 
    api.get('/tags/keys'),

  // Search resources by tag
  searchByTag: (tagKey: string, tagValue?: string) => 
    api.get('/tags/search', { params: { key: tagKey, value: tagValue } }),
};