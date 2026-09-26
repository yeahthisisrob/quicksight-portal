/**
 * Export operation types, all from the generated OpenAPI schema.
 */
import type { components } from '@shared/generated';

type Schemas = components['schemas'];

export type JobStatus = Schemas['JobStatus'];

/** The POST /api/export body. */
export type ExportJobOptions = Schemas['ExportJobRequest'];

/** Which parts of each asset an export re-reads. */
export type RefreshOptions = NonNullable<ExportJobOptions['refreshOptions']>;

/** One line of a job's log. */
export type ExportLogEntry = Schemas['JobLog'];
