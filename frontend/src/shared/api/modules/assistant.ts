import type { components } from '@shared/generated/types';

import { api as apiClient } from '../client';
import type { ApiResponse } from '../types';
import { type JobMetadata, jobsApi } from './jobs';

type Schemas = components['schemas'];
export type AiModelKey = Schemas['AiModelKey'];
export type AiModel = Schemas['AiModel'];
export type AiModelCatalog = Schemas['AiModelCatalog'];
export type AssistantChatRequest = Schemas['AssistantChatRequest'];
export type AssistantChatResult = Schemas['AssistantChatResult'];
export type AssistantArtifact = Schemas['AssistantArtifact'];
export type AssistantAction = Schemas['AssistantAction'];
type JobQueued = Schemas['JobQueued'];

/** The API base already ends in /api; the assistant speaks in full /api paths. */
function relative(path: string): string {
  return path.replace(/^\/api(?=\/)/, '');
}

export const assistantApi = {
  async models(): Promise<AiModelCatalog> {
    const response = await apiClient.get<ApiResponse<AiModelCatalog>>('/assistant/models');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to load the models');
    }
    return response.data.data;
  },

  /** Send one message; the assistant answers as a job. Returns its id. */
  async send(request: AssistantChatRequest): Promise<string> {
    const response = await apiClient.post<ApiResponse<JobQueued>>('/assistant/chat', request);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to send the message');
    }
    return response.data.data.jobId;
  },

  /** Wait for an answer, reporting each step; also resumes a wait after a page reload. */
  waitForAnswer(
    jobId: string,
    onProgress?: (job: JobMetadata) => void
  ): Promise<AssistantChatResult> {
    return jobsApi.awaitResult<AssistantChatResult>(jobId, { intervalMs: 1000, onProgress });
  },

  /** Re-run a read-only preview the assistant ran, to draw it. */
  async rerunPreview(artifact: AssistantArtifact): Promise<Record<string, any>> {
    const response = await apiClient.post<ApiResponse<Record<string, any>>>(
      relative(artifact.path ?? ''),
      artifact.body ?? {}
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'The preview could not be run');
    }
    return response.data.data;
  },

  /** Run a prepared write with the person's own session. */
  async runAction(action: AssistantAction): Promise<unknown> {
    const response = await apiClient.request<ApiResponse<unknown> & { jobId?: string }>({
      method: action.method,
      url: relative(action.path),
      ...(action.body !== undefined ? { data: action.body } : {}),
    });
    if (response.data && (response.data as any).success === false) {
      throw new Error((response.data as any).error || 'The action failed');
    }
    return response.data;
  },
};
