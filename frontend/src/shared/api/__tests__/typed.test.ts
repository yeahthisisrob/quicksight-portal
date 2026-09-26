import { describe, expect, it } from 'vitest';

import { ApiError, unwrap } from '../typed';

const response = (status: number) => new Response(null, { status });

describe('unwrap', () => {
  it('gives the envelope data on success', () => {
    expect(
      unwrap({ data: { success: true, data: { n: 1 } }, response: response(200) }, 'x')
    ).toEqual({ n: 1 });
  });

  it("throws the server's message on success: false and on an HTTP error, else the fallback", () => {
    expect(() =>
      unwrap(
        { data: { success: false, error: 'No such folder' }, response: response(200) },
        'Failed'
      )
    ).toThrow('No such folder');

    let caught: unknown;
    try {
      unwrap({ error: { error: 'Forbidden here' }, response: response(403) }, 'Failed');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ message: 'Forbidden here', status: 403 });

    expect(() => unwrap({ error: {}, response: response(500) }, 'Failed to list')).toThrow(
      'Failed to list'
    );
  });
});
