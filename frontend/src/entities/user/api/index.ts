import { api } from '@/shared/api';
// Types are available for future use

export const userApi = {
  // Get current user
  getCurrentUser: () => 
    api.get('/auth/me'),

  // List all users
  list: () => 
    api.get('/users'),

  // Get user details
  getById: (userId: string) => 
    api.get(`/users/${userId}`),

  // Get user permissions
  getUserPermissions: (userId: string) => 
    api.get(`/users/${userId}/permissions`),

  // Get user's assets
  getUserAssets: (userId: string) => 
    api.get(`/users/${userId}/assets`),

  // Search users
  search: (query: string) => 
    api.get('/users/search', { params: { q: query } }),
};