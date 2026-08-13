import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { applyHttpCaching, computeStrongEtag, etagMatches } from '../httpCaching';

function getEvent(headers: Record<string, string> = {}, method = 'GET'): APIGatewayProxyEvent {
  return { httpMethod: method, headers } as unknown as APIGatewayProxyEvent;
}

function okResponse(body: string): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Access-Control-Allow-Origin': 'https://example.cloudfront.net',
    },
    body,
  };
}

describe('computeStrongEtag', () => {
  it('is deterministic and quoted', () => {
    const first = computeStrongEtag('{"a":1}');
    const second = computeStrongEtag('{"a":1}');
    expect(first).toBe(second);
    expect(first.startsWith('"')).toBe(true);
    expect(first.endsWith('"')).toBe(true);
  });

  it('differs for different bodies', () => {
    expect(computeStrongEtag('{"a":1}')).not.toBe(computeStrongEtag('{"a":2}'));
  });
});

describe('etagMatches', () => {
  const etag = computeStrongEtag('body');

  it('matches an exact tag', () => {
    expect(etagMatches(etag, etag)).toBe(true);
  });

  it('matches within a comma-separated list', () => {
    expect(etagMatches(`"other", ${etag}, "another"`, etag)).toBe(true);
  });

  it('matches weak-prefixed tags (weak comparison)', () => {
    expect(etagMatches(`W/${etag}`, etag)).toBe(true);
  });

  it('matches the wildcard', () => {
    expect(etagMatches('*', etag)).toBe(true);
  });

  it('does not match a different tag or missing header', () => {
    expect(etagMatches('"nope"', etag)).toBe(false);
    expect(etagMatches(undefined, etag)).toBe(false);
  });
});

describe('applyHttpCaching', () => {
  it('adds ETag and revalidation Cache-Control to GET 200s, dropping Pragma/Expires', () => {
    const result = applyHttpCaching(getEvent(), okResponse('{"items":[]}'));

    expect(result.statusCode).toBe(STATUS_CODES.OK);
    expect(result.headers?.ETag).toBe(computeStrongEtag('{"items":[]}'));
    expect(result.headers?.['Cache-Control']).toBe('private, no-cache');
    expect(result.headers?.Pragma).toBeUndefined();
    expect(result.headers?.Expires).toBeUndefined();
    // CORS and content-type preserved
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('https://example.cloudfront.net');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    expect(result.body).toBe('{"items":[]}');
  });

  it('returns an empty-body 304 when If-None-Match matches (lowercase header)', () => {
    const body = '{"items":[1,2,3]}';
    const etag = computeStrongEtag(body);
    const result = applyHttpCaching(getEvent({ 'if-none-match': etag }), okResponse(body));

    expect(result.statusCode).toBe(STATUS_CODES.NOT_MODIFIED);
    expect(result.body).toBe('');
    expect(result.headers?.ETag).toBe(etag);
    expect(result.headers?.['Cache-Control']).toBe('private, no-cache');
  });

  it('handles mixed-case If-None-Match header names', () => {
    const body = '{"x":1}';
    const etag = computeStrongEtag(body);
    const result = applyHttpCaching(getEvent({ 'If-None-Match': etag }), okResponse(body));
    expect(result.statusCode).toBe(STATUS_CODES.NOT_MODIFIED);
  });

  it('returns 200 when If-None-Match does not match', () => {
    const result = applyHttpCaching(
      getEvent({ 'if-none-match': '"stale"' }),
      okResponse('{"fresh":true}')
    );
    expect(result.statusCode).toBe(STATUS_CODES.OK);
    expect(result.body).toBe('{"fresh":true}');
  });

  it('leaves non-GET responses untouched', () => {
    const response = okResponse('{"created":true}');
    const result = applyHttpCaching(getEvent({}, 'POST'), response);
    expect(result).toBe(response);
    expect(result.headers?.['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
  });

  it('leaves GET error responses untouched', () => {
    const response: APIGatewayProxyResult = { ...okResponse('{"error":"nope"}'), statusCode: 404 };
    const result = applyHttpCaching(getEvent(), response);
    expect(result).toBe(response);
    expect(result.headers?.ETag).toBeUndefined();
  });
});
