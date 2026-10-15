import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';
import { jobsApi } from './jobs';

type Schemas = components['schemas'];

export type Note = Schemas['Note'];
export type LearnResult = Schemas['LearnResult'];
type PersonNoteKind = 'meaning' | 'rule' | 'identity' | 'preference' | 'description';

/** What is known about the things in the account, by graph entity id. */
export const knowledgeApi = {
  /** Everything of a status across the account, newest first: the review queue, or what is known. */
  async listAll(status: 'confirmed' | 'draft', limit?: number): Promise<Note[]> {
    return unwrap(
      await client.GET('/api/knowledge', {
        params: { query: { status, ...(limit ? { limit } : {}) } },
      }),
      'Notes could not be read'
    ).notes;
  },

  async list(entityId: string, status?: 'confirmed' | 'draft'): Promise<Note[]> {
    return unwrap(
      await client.GET('/api/knowledge/{entityId}', {
        params: { path: { entityId }, query: status ? { status } : {} },
      }),
      'Notes could not be read'
    ).notes;
  },

  async add(
    entityId: string,
    note: { kind: PersonNoteKind; text: string; resolves?: string }
  ): Promise<Note> {
    return unwrap(
      await client.POST('/api/knowledge/{entityId}', {
        params: { path: { entityId } },
        body: note,
      }),
      'The note could not be saved'
    );
  },

  async confirm(entityId: string, noteId: string, text?: string): Promise<Note> {
    return unwrap(
      await client.POST('/api/knowledge/{entityId}/{noteId}/confirm', {
        params: { path: { entityId, noteId } },
        body: text ? { text } : {},
      }),
      'The note could not be confirmed'
    );
  },

  async remove(entityId: string, noteId: string): Promise<void> {
    unwrap(
      await client.DELETE('/api/knowledge/{entityId}/{noteId}', {
        params: { path: { entityId, noteId } },
      }),
      'The note could not be removed'
    );
  },

  /** Learn what an analysis or dashboard is for; the job's result lists the drafts and questions. */
  async learn(
    assetType: 'dashboard' | 'analysis',
    assetId: string,
    model?: string
  ): Promise<LearnResult> {
    const queued = unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/learn', {
        params: { path: { assetType, assetId } },
        body: model ? { model: model as never } : {},
      }),
      'The learning could not start'
    );
    return jobsApi.awaitResult<LearnResult>(queued.jobId);
  },
};
