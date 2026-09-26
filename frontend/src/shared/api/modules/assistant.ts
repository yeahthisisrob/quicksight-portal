import type { components } from '@shared/generated/types';

import { ApiError, client, unwrap } from '../typed';
import { type JobMetadata, jobsApi } from './jobs';

type Schemas = components['schemas'];
export type AiModelKey = Schemas['AiModelKey'];
export type AiModel = Schemas['AiModel'];
type AiModelCatalog = Schemas['AiModelCatalog'];
type AssistantChatRequest = Schemas['AssistantChatRequest'];
export type AssistantChatResult = Schemas['AssistantChatResult'];
export type AssistantArtifact = Schemas['AssistantArtifact'];
export type AssistantAction = Schemas['AssistantAction'];
export type FieldVerdict = Schemas['FieldVerdict'];
export type AgUiInterrupt = Schemas['AgUiInterrupt'];
export type AgUiResumeEntry = Schemas['AgUiResumeEntry'];
export type AssistantWorkingState = Schemas['AssistantWorkingState'];
export type AssistantQuestionOption = Schemas['AssistantQuestionOption'];

type Envelope = { success?: boolean; data?: unknown; error?: string; jobId?: string };

/**
 * The assistant names concrete paths (a preview it ran, a write it prepared)
 * at run time, so these calls cannot be checked against the contract; they
 * still go through the typed client for its session handling.
 */
const untyped = client as unknown as {
  request(
    method: string,
    url: string,
    init?: { body?: unknown }
  ): Promise<{ data?: Envelope; error?: Envelope; response: Response }>;
};

async function callPath(
  method: string,
  path: string,
  body: unknown,
  fallback: string
): Promise<Envelope> {
  const result = await untyped.request(method, path, body === undefined ? {} : { body });
  if (result.error !== undefined || result.data?.success === false) {
    throw new ApiError(
      result.error?.error ?? result.data?.error ?? fallback,
      result.response.status
    );
  }
  return result.data ?? {};
}

export const assistantApi = {
  async models(): Promise<AiModelCatalog> {
    return unwrap(await client.GET('/api/assistant/models'), 'Failed to load the models');
  },

  /** Send one message; the assistant answers as a job. Returns its id. */
  async send(request: AssistantChatRequest): Promise<string> {
    return unwrap(
      await client.POST('/api/assistant/chat', { body: request }),
      'Failed to send the message'
    ).jobId;
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
    const body = await callPath(
      'POST',
      artifact.path ?? '',
      artifact.body ?? {},
      'The preview could not be run'
    );
    if (!body.data) {
      throw new Error('The preview could not be run');
    }
    return body.data as Record<string, any>;
  },

  /** Run a prepared write with the person's own session. The whole body: a job answers with a top-level jobId. */
  runAction(action: AssistantAction): Promise<unknown> {
    return callPath(action.method, action.path, action.body, 'The action failed');
  },
};
