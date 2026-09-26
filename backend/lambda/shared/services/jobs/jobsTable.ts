/** The one DynamoDB table jobs, their logs, their items and the export lock live in. */
export function jobsTableName(): string {
  return (
    process.env.JOBS_TABLE_NAME || `quicksight-portal-jobs-${process.env.AWS_ACCOUNT_ID || ''}`
  );
}

/** Days a job (and everything under it) is kept, plus a grace the TTL sweep may lag by. */
export const JOB_TTL_GRACE_DAYS = 7;
