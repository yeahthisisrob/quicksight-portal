import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { getApiErrorMessage, settingsApi } from '@/shared/api';
import type { SettingsSnapshot } from '@/shared/api/modules/settings';

import {
  changedKeys,
  type SettingsDraft,
  type SettingsFormAction,
  settingsFormReducer,
  toUpdate,
} from '../model/settingsForm';

export const SETTINGS_QUERY_KEY = ['settings'] as const;

export interface UseSettingsFormOptions {
  /** Pre-filled changes (stories, tests). */
  initialDraft?: SettingsDraft;
  /** Called after a successful save. */
  onSaved?: () => void;
}

/**
 * Loads the settings, keeps the user's unsaved changes, and saves them.
 * The draft is separate from the server snapshot so a save can be partial
 * and a discard is free.
 */
export function useSettingsForm({ initialDraft = {}, onSaved }: UseSettingsFormOptions = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: () => settingsApi.get() });
  const snapshot: SettingsSnapshot | undefined = query.data;

  const [draft, setDraft] = useState<SettingsDraft>(initialDraft);
  const dispatch = useCallback(
    (action: SettingsFormAction) => {
      setDraft((prev) => settingsFormReducer(prev, action, snapshot));
    },
    [snapshot]
  );

  const mutation = useMutation({
    mutationFn: () => settingsApi.update(toUpdate(draft)),
    onSuccess: (next) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, next);
      setDraft({});
      onSaved?.();
    },
  });

  const changed = useMemo(() => changedKeys(draft), [draft]);

  return {
    snapshot,
    isLoading: query.isLoading,
    loadError: query.isError ? getApiErrorMessage(query.error, 'Failed to load settings') : null,
    reload: query.refetch,
    draft,
    dispatch,
    changedCount: changed.length,
    isDirty: changed.length > 0,
    save: () => mutation.mutate(),
    isSaving: mutation.isPending,
    saveError: mutation.isError ? getApiErrorMessage(mutation.error, 'Failed to save settings') : null,
    clearSaveError: mutation.reset,
  };
}

export type SettingsForm = ReturnType<typeof useSettingsForm>;
