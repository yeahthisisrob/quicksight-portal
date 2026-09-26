/**
 * Composing a playbook, in the URL: `build=new`, `build=<id>` to edit a
 * saved one, `build=copy:<id>` to start from any spec-built one (a shipped
 * example included). Saving opens the playbook, ready to preview.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { getApiErrorMessage, playbooksApi } from '@/shared/api';
import type { PlaybookSpec, PlaybookSpecInput } from '@/shared/api/modules/playbooks';

const COPY = 'copy:';

export const BLANK_SPEC: PlaybookSpecInput = {
  name: '',
  description: '',
  inputs: [],
  select: { assetTypes: ['dashboard'], where: [] },
  steps: [],
  gates: { editedWithinDays: 7 },
};

/** A spec's editable part (its id and dates stay with the saved one). */
function editable(spec: PlaybookSpec, copy: boolean): PlaybookSpecInput {
  return {
    name: copy ? `${spec.name} (copy)` : spec.name,
    description: spec.description ?? '',
    inputs: spec.inputs,
    select: spec.select,
    steps: spec.steps,
    ...(spec.gates ? { gates: spec.gates } : {}),
  };
}

export function usePlaybookBuilder() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const build = params.get('build');
  const copy = build?.startsWith(COPY) ?? false;
  const sourceId = build && build !== 'new' ? (copy ? build.slice(COPY.length) : build) : null;

  const source = useQuery({
    queryKey: ['playbook-spec', sourceId],
    queryFn: () => playbooksApi.getSpec(sourceId!),
    enabled: sourceId !== null,
  });

  const close = (openId?: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('build');
      if (openId) next.set('playbook', openId);
      return next;
    });

  const save = useMutation({
    mutationFn: (spec: PlaybookSpecInput) =>
      sourceId && !copy ? playbooksApi.updateSpec(sourceId, spec) : playbooksApi.createSpec(spec),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      close(saved.id);
    },
  });

  return {
    open: build !== null,
    title: copy ? 'Copy a playbook' : sourceId ? 'Change a playbook' : 'New playbook',
    loading: sourceId !== null && source.isLoading,
    loadError: source.error
      ? getApiErrorMessage(source.error, 'Could not read the playbook')
      : null,
    initial: source.data ? editable(source.data, copy) : sourceId ? null : BLANK_SPEC,
    /** Changes when what is being edited does, so the form starts again. */
    key: build ?? '',
    save: (spec: PlaybookSpecInput) => save.mutate(spec),
    saving: save.isPending,
    saveError: save.error ? getApiErrorMessage(save.error, 'Could not save the playbook') : null,
    cancel: () => close(),
  };
}

/** Start the builder: blank, on a saved playbook, or as a copy of any spec-built one. */
export function useStartBuilder() {
  const [, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const go = (value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('build', value);
      next.delete('playbook');
      next.delete('preview');
      next.delete('run');
      return next;
    });
  const remove = useMutation({
    mutationFn: (id: string) => playbooksApi.deleteSpec(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playbooks'] }),
  });
  return {
    create: () => go('new'),
    edit: (id: string) => go(id),
    copy: (id: string) => go(`${COPY}${id}`),
    remove: (id: string) => remove.mutate(id),
  };
}
