import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  aiModelViews,
  DEFAULT_AUTHORING_MODEL,
  DEFAULT_CHAT_MODEL,
  isAiModelKey,
} from '../../../shared/ai/modelCatalog';
import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { jobFactory } from '../../../shared/services/jobs/JobFactory';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { parseRunInput } from '../lib/runInput';
import type { ChatHistoryMessage } from '../types';

const MAX_MESSAGES = 40;

/** GET /assistant/models - what can be picked, what it costs, and the defaults. */
export async function listModels(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    return successResponse(event, {
      success: true,
      data: {
        models: aiModelViews(),
        defaults: { authoring: DEFAULT_AUTHORING_MODEL, chat: DEFAULT_CHAT_MODEL },
        note: 'List prices per million tokens; Bedrock bills Claude at its own rates, so estimates are rough.',
      },
    });
  } catch (error: any) {
    logger.error('List models failed', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to list models'
    );
  }
}

function badRequest(event: APIGatewayProxyEvent, message: string): APIGatewayProxyResult {
  return errorResponse(event, STATUS_CODES.BAD_REQUEST, message);
}

/**
 * POST /assistant/chat - one message to the assistant, as a job: a few
 * tool rounds can outlive a web request. The job's result is an
 * AssistantChatResult.
 */
export async function chat(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await requireAuth(event);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return badRequest(event, 'Request body is not valid JSON');
    }
    const messages = body.messages;
    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > MAX_MESSAGES ||
      messages.some(
        (m) =>
          typeof m !== 'object' ||
          m === null ||
          (m.role !== 'user' && m.role !== 'assistant') ||
          typeof m.text !== 'string'
      )
    ) {
      return badRequest(
        event,
        `messages must be 1-${MAX_MESSAGES} of { role: 'user' | 'assistant', text }`
      );
    }
    if (
      messages[messages.length - 1].role !== 'user' ||
      !messages[messages.length - 1].text.trim()
    ) {
      return badRequest(event, "The last message must be the person's, and not empty");
    }
    const model = body.model ?? DEFAULT_CHAT_MODEL;
    if (!isAiModelKey(model)) {
      return badRequest(
        event,
        `model must be one of: ${aiModelViews()
          .map((m) => m.key)
          .join(', ')}`
      );
    }
    const view = aiModelViews().find((m) => m.key === model);
    if (!view?.available) {
      return badRequest(
        event,
        `${view?.label ?? model} is not available here. ${view?.unavailableReason ?? ''}`.trim()
      );
    }
    const runInput = parseRunInput(body);
    if (typeof runInput === 'string') {
      return badRequest(event, runInput);
    }
    const authoringModel = body.authoringModel;
    if (authoringModel !== undefined && !isAiModelKey(authoringModel)) {
      return badRequest(event, 'authoringModel must be a model key');
    }
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const queued = await jobFactory.createJob({
      jobType: 'assistant',
      accountId,
      bucketName: process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`,
      userId: user.userId,
      model,
      ...(authoringModel ? { authoringModel } : {}),
      messages: messages as ChatHistoryMessage[],
      ...runInput,
      // The identity the assistant's calls run as: the same person, with
      // the same groups, or the same API key.
      auth: {
        userId: user.userId,
        accountId: user.accountId,
        ...(user.email ? { email: user.email } : {}),
        ...(user.groups ? { groups: user.groups } : {}),
        ...(user.apiKey ? { apiKey: user.apiKey } : {}),
      },
    });
    return createResponse(event, STATUS_CODES.ACCEPTED, { success: true, data: queued });
  } catch (error: any) {
    logger.error('Assistant chat failed', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Failed to queue the message'
    );
  }
}
