import { api } from '@/shared/api';

import type { Folder } from '../model';
import type { BulkAssetReference } from '@/shared/types/bulk';

export const folderApi = {
  // List all folders
  list: () => 
    api.get('/folders'),

  // Get folder details
  getById: (folderId: string) => 
    api.get(`/folders/${folderId}`),

  // Get folder members
  getMembers: (folderId: string) => 
    api.get(`/folders/${folderId}/members`),

  // Add member to folder
  addMember: (folderId: string, member: { MemberType: string; MemberId: string }) => 
    api.post(`/folders/${folderId}/members`, member),

  // Remove member from folder
  removeMember: (folderId: string, memberType: string, memberId: string) => 
    api.delete(`/folders/${folderId}/members/${memberType}/${memberId}`),

  // Create folder
  create: (folder: Partial<Folder>) => 
    api.post('/folders', folder),

  // Update folder
  update: (folderId: string, updates: Partial<Folder>) => 
    api.put(`/folders/${folderId}`, updates),

  // Delete folder
  delete: (folderId: string) => 
    api.delete(`/folders/${folderId}`),

  // Bulk add assets to folder
  bulkAddAssets: (folderId: string, assets: BulkAssetReference[]) =>
    api.post(`/folders/${folderId}/assets/bulk`, { assets }),

  // Bulk remove assets from folder
  bulkRemoveAssets: (folderId: string, assets: BulkAssetReference[]) =>
    api.delete(`/folders/${folderId}/assets/bulk`, { data: { assets } }),
};