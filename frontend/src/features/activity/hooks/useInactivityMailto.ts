import { useState, useEffect, useCallback, useMemo } from 'react';

import { activityApi, type RecipientsData } from '@/shared/api/modules/activity';
import { getQuickSightConsoleUrl } from '@/shared/lib/assetTypeUtils';

import type { ActivityData } from '../model/types';

interface UseInactivityMailtoProps {
  open: boolean;
  asset: {
    id: string;
    name: string;
    type: 'dashboard' | 'analysis';
    lastViewed?: string | null;
    activityCount?: number;
  };
}

export interface GroupActivityBreakdown {
  groupName: string;
  viewCount: number;
  viewerCount: number;
}

export function useInactivityMailto({ open, asset }: UseInactivityMailtoProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<RecipientsData | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');

  // Activity breakdown state
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());

  const typeLabel = asset.type === 'dashboard' ? 'Dashboard' : 'Analysis';
  const assetUrl = getQuickSightConsoleUrl(asset.type, asset.id);

  // Compute group breakdown from activity data
  const groupBreakdown = useMemo((): GroupActivityBreakdown[] => {
    if (!activityData?.viewers) return [];

    const groupMap = new Map<string, { viewCount: number; viewers: Set<string> }>();

    for (const viewer of activityData.viewers) {
      const groups = viewer.groups?.length ? viewer.groups : ['(ungrouped)'];
      for (const group of groups) {
        if (!groupMap.has(group)) {
          groupMap.set(group, { viewCount: 0, viewers: new Set() });
        }
        const entry = groupMap.get(group)!;
        entry.viewCount += viewer.viewCount;
        entry.viewers.add(viewer.userName);
      }
    }

    return Array.from(groupMap.entries())
      .map(([groupName, data]) => ({
        groupName,
        viewCount: data.viewCount,
        viewerCount: data.viewers.size,
      }))
      .sort((a, b) => b.viewCount - a.viewCount);
  }, [activityData]);

  // Filtered viewers + totals after excluding groups
  const filteredActivity = useMemo(() => {
    if (!activityData?.viewers) {
      return { totalViews: asset.activityCount ?? 0, uniqueViewers: 0, viewers: [] as ActivityData['viewers'] };
    }

    const includedViewers = activityData.viewers.filter((v) => {
      if (excludedGroups.size === 0) return true;
      const groups = v.groups?.length ? v.groups : ['(ungrouped)'];
      return !groups.every((g) => excludedGroups.has(g));
    });

    return {
      totalViews: includedViewers.reduce((sum, v) => sum + v.viewCount, 0),
      uniqueViewers: includedViewers.length,
      viewers: includedViewers,
    };
  }, [activityData, excludedGroups, asset.activityCount]);

  const inactivityText = useMemo(() => {
    if (!asset.lastViewed) return 'has never been viewed';
    const days = Math.floor(
      (Date.now() - new Date(asset.lastViewed).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return 'was viewed today';
    if (days === 1) return 'was last viewed yesterday';
    return `hasn't been viewed in ${days} days`;
  }, [asset.lastViewed]);

  // Build email body with asset link + viewer table (honoring group exclusions)
  const body = useMemo(() => {
    const lines: string[] = [];
    lines.push('Hi,');
    lines.push('');
    lines.push(`The ${typeLabel.toLowerCase()} "${asset.name}" ${inactivityText}.`);

    if (assetUrl) {
      lines.push('');
      lines.push(`View in QuickSight: ${assetUrl}`);
    }

    if (filteredActivity.viewers.length > 0) {
      lines.push('');
      lines.push(`Activity (${filteredActivity.totalViews} views, ${filteredActivity.uniqueViewers} users):`);

      const sorted = [...filteredActivity.viewers].sort((a, b) => b.viewCount - a.viewCount);
      for (const viewer of sorted) {
        const lastDate = new Date(viewer.lastViewed).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        lines.push(`  - ${viewer.userName}: ${viewer.viewCount} views (last: ${lastDate})`);
      }

      if (excludedGroups.size > 0) {
        lines.push(`  * Excluded groups: ${Array.from(excludedGroups).join(', ')}`);
      }
    }

    lines.push('');
    lines.push('Please review whether this asset is still needed or can be deleted.');
    lines.push('');
    lines.push('Thank you');

    return lines.join('\n');
  }, [typeLabel, asset.name, inactivityText, assetUrl, filteredActivity, excludedGroups]);

  // Fetch recipients + activity data when dialog opens
  useEffect(() => {
    if (!open) return;

    setSubject(`Inactive ${typeLabel}: ${asset.name}`);

    let cancelled = false;
    setLoading(true);
    setError(null);

    const recipientsPromise = activityApi
      .resolveRecipients(asset.type, asset.id)
      .catch((err) => {
        console.error('[InactivityMailto] Failed to resolve recipients:', err);
        return { users: [], groups: [] } as RecipientsData;
      });

    const activityPromise = activityApi
      .getActivityData(asset.type, asset.id)
      .then((data) => data as ActivityData)
      .catch((err) => {
        console.error('[InactivityMailto] Failed to fetch activity data:', err);
        return null;
      });

    Promise.all([recipientsPromise, activityPromise]).then(([recipientsData, activity]) => {
      if (cancelled) return;
      setRecipients(recipientsData);
      setActivityData(activity);

      // Auto-select direct users only — group members must be toggled in manually
      const directEmails = new Set<string>();
      recipientsData.users.forEach((u) => directEmails.add(u.email));
      setSelectedEmails(directEmails);

      if (recipientsData.users.length === 0 && recipientsData.groups.length === 0) {
        setError('Could not resolve recipients from asset permissions. You can still compose and send the email manually.');
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, asset.id, asset.type, asset.name, typeLabel, inactivityText]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setRecipients(null);
      setSelectedEmails(new Set());
      setExpandedGroups(new Set());
      setActivityData(null);
      setExcludedGroups(new Set());
      setError(null);
    }
  }, [open]);

  const toggleExcludeGroup = useCallback((groupName: string) => {
    setExcludedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const toggleEmail = useCallback((email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const toggleGroup = useCallback(
    (groupName: string) => {
      if (!recipients) return;
      const group = recipients.groups.find((g) => g.groupName === groupName);
      if (!group) return;

      setSelectedEmails((prev) => {
        const next = new Set(prev);
        const groupEmails = group.members.map((m) => m.email);
        const allSelected = groupEmails.every((e) => next.has(e));

        if (allSelected) {
          groupEmails.forEach((e) => next.delete(e));
        } else {
          groupEmails.forEach((e) => next.add(e));
        }
        return next;
      });
    },
    [recipients]
  );

  const toggleExpandGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!recipients) return;
    const allEmails = new Set<string>();
    recipients.users.forEach((u) => allEmails.add(u.email));
    recipients.groups.forEach((g) => g.members.forEach((m) => allEmails.add(m.email)));
    setSelectedEmails(allEmails);
  }, [recipients]);

  const deselectAll = useCallback(() => {
    setSelectedEmails(new Set());
  }, []);

  const openMailto = useCallback(() => {
    const emails = Array.from(selectedEmails).join(',');
    const mailto = `mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto);
  }, [selectedEmails, subject, body]);

  return {
    loading,
    error,
    recipients,
    selectedEmails,
    expandedGroups,
    subject,
    setSubject,
    body,
    inactivityText,
    toggleEmail,
    toggleGroup,
    toggleExpandGroup,
    selectAll,
    deselectAll,
    openMailto,
    selectedCount: selectedEmails.size,
    // Activity breakdown
    groupBreakdown,
    filteredActivity,
    excludedGroups,
    toggleExcludeGroup,
    hasActivityData: activityData !== null,
  };
}
