/**
 * A job's log, followed while it runs. The first read takes everything; each
 * later read asks only for the lines after the last cursor, so following a
 * long export costs a few new lines a poll rather than the whole log again.
 * When following stops (the job ended), one last read picks up the tail.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { getApiErrorMessage } from '@/shared/api';
import { type JobLog, jobsApi } from '@/shared/api/modules/jobs';

const FOLLOW_INTERVAL_MS = 3000;

export interface JobLogs {
  logs: JobLog[];
  loading: boolean;
  error: string | null;
}

export function useJobLogs(jobId: string | null, { follow }: { follow: boolean }): JobLogs {
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string | undefined>(undefined);
  // Bumped per job, so a read that answers after the job changed is dropped.
  const generation = useRef(0);

  const readNext = useCallback(async () => {
    if (!jobId) return;
    const mine = generation.current;
    try {
      const page = await jobsApi.getJobLogPage(jobId, cursor.current);
      if (mine !== generation.current) return;
      cursor.current = page.cursor ?? cursor.current;
      if (page.logs.length > 0) {
        setLogs((prev) => [...prev, ...page.logs]);
      }
      setError(null);
    } catch (e) {
      if (mine === generation.current) {
        setError(getApiErrorMessage(e, 'Could not load the log'));
      }
    }
  }, [jobId]);

  // A new job: start over and read everything.
  useEffect(() => {
    generation.current += 1;
    cursor.current = undefined;
    setLogs([]);
    setError(null);
    if (!jobId) return;
    setLoading(true);
    void readNext().finally(() => setLoading(false));
  }, [jobId, readNext]);

  // While following, read what is new on an interval; on stopping, once more.
  const wasFollowing = useRef(follow);
  useEffect(() => {
    if (!jobId) return;
    if (!follow) {
      if (wasFollowing.current) void readNext();
      wasFollowing.current = false;
      return;
    }
    wasFollowing.current = true;
    const timer = setInterval(() => void readNext(), FOLLOW_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobId, follow, readNext]);

  return { logs, loading, error };
}
