import { useState, useEffect, useCallback, useMemo } from 'react';

import { activityApi } from '@/shared/api/modules/activity';

import type { components } from '@shared/generated/types';

type UserUnusedDataset = components['schemas']['UserUnusedDataset'];

interface UseUserUnusedDatasetsProps {
  open: boolean;
  user: { name: string; email: string };
}

export function useUserUnusedDatasets({ open, user }: UseUserUnusedDatasetsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<UserUnusedDataset[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');

  const body = useMemo(() => {
    const lines: string[] = [];
    lines.push('Hi,');
    lines.push('');
    lines.push(
      `The following datasets owned by ${user.name} are not used by any dashboards or analyses. Please review whether they are still needed or can be deleted.`
    );
    lines.push('');

    if (datasets.length > 0) {
      lines.push(`Unused Datasets (${datasets.length}):`);
      lines.push('');

      for (const dataset of datasets) {
        const created = dataset.createdTime
          ? new Date(dataset.createdTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Unknown';
        const modified = dataset.lastUpdatedTime
          ? new Date(dataset.lastUpdatedTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Unknown';

        const mode = dataset.importMode === 'SPICE' ? 'SPICE' : 'Direct Query';
        const sizeInfo = dataset.importMode === 'SPICE' && dataset.sizeFormatted
          ? ` (${dataset.sizeFormatted})`
          : dataset.importMode === 'SPICE'
            ? ' (size unknown)'
            : '';

        lines.push(`  - ${dataset.datasetName}`);
        lines.push(`    Created: ${created} | Modified: ${modified}`);
        lines.push(`    Mode: ${mode}${sizeInfo}`);
        lines.push('');
      }
    }

    lines.push('Please review and delete any datasets that are no longer needed.');
    if (datasets.some((d) => d.importMode === 'SPICE' && d.sizeInBytes > 0)) {
      lines.push('Deleting unused SPICE datasets will free up SPICE capacity.');
    }
    lines.push('');
    lines.push('Note: Due to QuickSight limitations, dataset usage may not be fully accurate. Please double-check with the Usage tab in the QuickSight console before deleting.');
    lines.push('');
    lines.push('Thank you');

    return lines.join('\n');
  }, [user.name, datasets]);

  // Fetch unused datasets when dialog opens
  useEffect(() => {
    if (!open) return;

    setSubject(`Unused Datasets Review: ${user.name}`);
    setSelectedEmails(new Set([user.email]));

    let cancelled = false;
    setLoading(true);
    setError(null);

    activityApi
      .getUserUnusedDatasets(user.name)
      .then((data) => {
        if (cancelled) return;
        setDatasets(data);
        if (data.length === 0) {
          setError('No unused datasets found for this user.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[UserUnusedDatasets] Failed to fetch unused datasets:', err);
        setError('Failed to fetch unused datasets.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user.name, user.email]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setDatasets([]);
      setSelectedEmails(new Set());
      setCcEmails([]);
      setError(null);
    }
  }, [open]);

  const toggleEmail = useCallback((email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const addCcEmail = useCallback((email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setCcEmails((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const removeCcEmail = useCallback((email: string) => {
    setCcEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const openMailto = useCallback(() => {
    const to = Array.from(selectedEmails).join(',');
    const cc = ccEmails.join(',');
    let mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (cc) {
      mailto += `&cc=${encodeURIComponent(cc)}`;
    }
    window.open(mailto);
  }, [selectedEmails, ccEmails, subject, body]);

  return {
    loading,
    error,
    datasets,
    selectedEmails,
    ccEmails,
    subject,
    setSubject,
    body,
    toggleEmail,
    addCcEmail,
    removeCcEmail,
    openMailto,
    selectedCount: selectedEmails.size,
  };
}
