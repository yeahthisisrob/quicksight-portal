/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, ReactNode, useCallback } from 'react';

interface FoldersContextType {
  // Methods to invalidate and refresh folder-related data
  invalidateFolders: () => Promise<void>;
  invalidateFolderMembers: (folderId?: string) => Promise<void>;
  invalidateFolderTags: () => Promise<void>;
  invalidateAllFolderData: () => Promise<void>;
  
  // Method to handle post-bulk operations
  handleBulkOperationComplete: () => Promise<void>;
}

const FoldersContext = createContext<FoldersContextType | undefined>(undefined);

export const useFolders = () => {
  const context = useContext(FoldersContext);
  if (!context) {
    throw new Error('useFolders must be used within a FoldersProvider');
  }
  return context;
};

interface FoldersProviderProps {
  children: ReactNode;
}

export const FoldersProvider: React.FC<FoldersProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  
  // Invalidate folders list
  const invalidateFolders = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['folders'] });
  }, [queryClient]);
  
  // Invalidate folder members - optionally for a specific folder
  const invalidateFolderMembers = useCallback(async (folderId?: string) => {
    if (folderId) {
      await queryClient.invalidateQueries({ queryKey: ['folder-members', folderId] });
    } else {
      await queryClient.invalidateQueries({ queryKey: ['folder-members'] });
    }
  }, [queryClient]);
  
  // Invalidate folder tags
  const invalidateFolderTags = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['live-tags-folders'] });
    await queryClient.invalidateQueries({ queryKey: ['folder-tags'] });
  }, [queryClient]);
  
  // Invalidate all folder-related data
  const invalidateAllFolderData = useCallback(async () => {
    await Promise.all([
      invalidateFolders(),
      invalidateFolderMembers(),
      invalidateFolderTags(),
    ]);
  }, [invalidateFolders, invalidateFolderMembers, invalidateFolderTags]);
  
  // Handle completion of bulk operations
  const handleBulkOperationComplete = useCallback(async () => {
    // Invalidate all folder-related queries to ensure fresh data
    await invalidateAllFolderData();
    
    // Also invalidate asset queries since assets may have moved
    await queryClient.invalidateQueries({ queryKey: ['assets'] });
    await queryClient.invalidateQueries({ queryKey: ['export-summary'] });
    
    // Invalidate paginated asset queries
    await queryClient.invalidateQueries({ queryKey: ['dashboards-paginated'] });
    await queryClient.invalidateQueries({ queryKey: ['datasets-paginated'] });
    await queryClient.invalidateQueries({ queryKey: ['analyses-paginated'] });
    await queryClient.invalidateQueries({ queryKey: ['datasources-paginated'] });
    
    // Also invalidate the live asset tags since folder membership affects visibility
    await queryClient.invalidateQueries({ queryKey: ['live-tags'] });
    
    // Invalidate master index which is used by asset lists
    await queryClient.invalidateQueries({ queryKey: ['master-index'] });
    
    // Invalidate data catalog queries since folder exclusions affect field visibility
    await queryClient.invalidateQueries({ queryKey: ['data-catalog'] });
    await queryClient.invalidateQueries({ queryKey: ['visual-field-catalog'] });
    await queryClient.invalidateQueries({ queryKey: ['catalog-stats'] });
    
    // Force a complete refresh of all queries
    await queryClient.refetchQueries();
  }, [queryClient, invalidateAllFolderData]);
  
  const value: FoldersContextType = {
    invalidateFolders,
    invalidateFolderMembers,
    invalidateFolderTags,
    invalidateAllFolderData,
    handleBulkOperationComplete,
  };
  
  return <FoldersContext.Provider value={value}>{children}</FoldersContext.Provider>;
};