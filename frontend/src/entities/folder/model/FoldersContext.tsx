/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { createContext, type ReactNode, useCallback, useContext } from 'react';

import { announceAssetChanges } from '@/shared/lib/assetChanges';

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
    await queryClient.invalidateQueries({ queryKey: ['folders-list'] });
  }, [queryClient]);

  // Invalidate folder members - optionally for a specific folder
  const invalidateFolderMembers = useCallback(
    async (folderId?: string) => {
      if (folderId) {
        await queryClient.invalidateQueries({ queryKey: ['folder-members', folderId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['folder-members'] });
      }
    },
    [queryClient]
  );

  // Invalidate folder tags
  const invalidateFolderTags = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['live-tags-folders'] });
    await queryClient.invalidateQueries({ queryKey: ['folder-tags'] });
  }, [queryClient]);

  // Invalidate all folder-related data
  const invalidateAllFolderData = useCallback(async () => {
    await Promise.all([invalidateFolders(), invalidateFolderMembers(), invalidateFolderTags()]);
  }, [invalidateFolders, invalidateFolderMembers, invalidateFolderTags]);

  // A bulk folder operation finished: folders, their members and the assets
  // in them all changed (the job re-read them before it reported done).
  const handleBulkOperationComplete = useCallback(async () => {
    await invalidateAllFolderData();
    announceAssetChanges();
  }, [invalidateAllFolderData]);

  const value: FoldersContextType = {
    invalidateFolders,
    invalidateFolderMembers,
    invalidateFolderTags,
    invalidateAllFolderData,
    handleBulkOperationComplete,
  };

  return <FoldersContext.Provider value={value}>{children}</FoldersContext.Provider>;
};
