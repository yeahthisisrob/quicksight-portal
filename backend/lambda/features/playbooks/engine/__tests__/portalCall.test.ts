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
