import { useState, useEffect, useCallback, useMemo } from 'react';

import { activityApi } from '@/shared/api/modules/activity';

import type { components } from '@shared/generated/types';

type UserInactiveAnalysis = components['schemas']['UserInactiveAnalysis'];

interface UseUserInactiveMailtoProps {
  open: boolean;
  user: { name: string; email: string };
}

export function useUserInactiveMailto({ open, user }: UseUserInactiveMailtoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<UserInactiveAnalysis[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState('');

  const body = useMemo(() => {
    const lines: string[] = [];
    lines.push('Hi,');
    lines.push('');
    lines.push(
      `The following analyses owned by ${user.name} have low activity (fewer than 10 views). Please review whether they are still needed or can be deleted.`
    );
    lines.push('');

    if (analyses.length > 0) {
      lines.push(`Inactive Analyses (${analyses.length}):`);
      lines.push('');

      for (const analysis of analyses) {
        const created = analysis.createdTime
          ? new Date(analysis.createdTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Unknown';
        const modified = analysis.lastUpdatedTime
          ? new Date(analysis.lastUpdatedTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Unknown';
        const lastViewed = analysis.lastViewed
          ? new Date(analysis.lastViewed).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Never';

        lines.push(`  - ${analysis.analysisName}`);
        lines.push(`    Created: ${created} | Modified: ${modified}`);
        lines.push(
          `    Views: ${analysis.totalViews} (${analysis.uniqueViewers} users) | Last viewed: ${lastViewed}`
        );
      }
    }

    lines.push('');
    lines.push('Please review and delete any analyses that are no longer needed.');
    lines.push('');
    lines.push('Thank you');

    return lines.join('\n');
  }, [user.name, analyses]);

  // Fetch inactive analyses when dialog opens
  useEffect(() => {
    if (!open) return;

    setSubject(`Inactive Analyses Review: ${user.name}`);
    setSelectedEmails(new Set([user.email]));

    let cancelled = false;
    setLoading(true);
    setError(null);

    activityApi
      .getUserInactiveAnalyses(user.name)
      .then((data) => {
        if (cancelled) return;
        setAnalyses(data);
        if (data.length === 0) {
          setError('No inactive analyses found for this user.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[UserInactiveMailto] Failed to fetch inactive analyses:', err);
        setError('Failed to fetch inactive analyses.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user.name, user.email]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setAnalyses([]);
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
    analyses,
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
