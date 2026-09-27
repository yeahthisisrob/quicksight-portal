import { describe, expect, it } from 'vitest';

import { errorResponse } from '../cors';
import { recordError, runWithRequestContext } from '../requestContext';

const event = { headers: {}, requestContext: { requestId: 'req-1' } } as any;

function awsError() {
  return Object.assign(new Error('STRING_VALUE can not be converted to an Integer'), {
    name: 'ValidationException',
    $metadata: { requestId: 'aws-9', httpStatusCode: 400 },
  });
}

describe('error responses carry what failed underneath', () => {
  it('attaches the logged error and the request id', async () => {
    const response = await runWithRequestContext('req-1', async () => {
      recordError({ error: awsError(), path: '/x' });
      return errorResponse(event, 500, 'Could not read the rows');
    });
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: 'Could not read the rows',
      detail: {
        name: 'ValidationException',
        cause: 'STRING_VALUE can not be converted to an Integer',
        awsRequestId: 'aws-9',
        awsStatus: 400,
        requestId: 'req-1',
      },
    });
  });

  it('takes a logged message when that is all there is, and keeps requests apart', async () => {
    const [a, b] = await Promise.all([
      runWithRequestContext('a', async () => {
        recordError({ error: 'Throttled' });
        await new Promise((r) => setTimeout(r, 5));
        return errorResponse(event, 500, 'Failed');
      }),
      runWithRequestContext('b', async () => errorResponse(event, 404, 'Not found')),
    ]);
    expect(JSON.parse(a.body).detail).toEqual({ cause: 'Throttled', requestId: 'a' });
    expect(JSON.parse(b.body).detail).toEqual({ requestId: 'b' });
  });

  it('adds nothing outside a request', () => {
    recordError(awsError());
    expect(JSON.parse(errorResponse(event, 400, 'Bad').body)).toEqual({
      success: false,
      error: 'Bad',
    });
  });
});
