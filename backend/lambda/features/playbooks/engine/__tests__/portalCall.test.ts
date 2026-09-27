import { describe, expect, it, vi } from 'vitest';

import { PortalCallError } from '../../types';
import { portalCall } from '../portalCall';

describe('portalCall', () => {
  it('returns the envelope’s data', async () => {
    const dispatch = vi.fn(async () => ({
      status: 200,
      body: JSON.stringify({ success: true, data: { tables: [] } }),
    }));
    await expect(portalCall(dispatch)('GET', '/api/x')).resolves.toEqual({ tables: [] });
    expect(dispatch).toHaveBeenCalledWith({ method: 'GET', path: '/api/x' });
  });

  it('throws the route’s own message with its status, naming the call', async () => {
    const dispatch = vi.fn(async () => ({
      status: 400,
      body: JSON.stringify({ success: false, error: 'Column revenue not found' }),
    }));
    const error = await portalCall(dispatch)('PUT', '/api/x?page=2', {}).catch((e) => e);
    expect(error).toBeInstanceOf(PortalCallError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Column revenue not found (PUT /api/x)',
    });
  });

  it('treats success:false as a failure even on 200', async () => {
    const dispatch = vi.fn(async () => ({
      status: 200,
      body: JSON.stringify({ success: false, error: { message: 'nope' } }),
    }));
    await expect(portalCall(dispatch)('GET', '/api/x')).rejects.toThrow('nope');
  });
});

describe('portalCall error detail', () => {
  it('adds what failed underneath when the route message hides it', async () => {
    const dispatch = vi.fn(async () => ({
      status: 500,
      body: JSON.stringify({
        success: false,
        error: 'Could not read the rows',
        detail: {
          name: 'ValidationException',
          cause: 'STRING_VALUE can not be converted to an Integer',
          requestId: 'r-1',
        },
      }),
    }));
    const error = (await portalCall(dispatch)('GET', '/api/playbooks/runs/j/items').catch(
      (e) => e
    )) as Error;
    expect(error.message).toBe(
      'Could not read the rows: ValidationException: STRING_VALUE can not be converted to an Integer (GET /api/playbooks/runs/j/items)'
    );
  });
});
