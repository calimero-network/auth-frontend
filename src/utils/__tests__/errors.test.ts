/**
 * The install screen said `HTTP 400 Bad Request` and told the reader to check
 * that their node was running, while the node had answered instantly with the
 * exact field it was refusing. These guards are written against that body.
 */
import { describe, it, expect } from 'vitest';
import {
  describeError,
  isReachabilityMessage,
  isReachabilityProblem,
  messageFromBody,
  statusOf,
} from '../errors';

/** The literal body core answered the broken install with. */
const INSTALL_400 = JSON.stringify({
  error:
    'Invalid JSON data: Failed to deserialize the JSON body into the target type: url: unknown field `url`, expected `package` or `version`',
});

/** Shaped like mero-js's HTTPError, without dragging the SDK into a unit test. */
const httpError = (status: number, statusText: string, bodyText?: string) =>
  Object.assign(
    new Error(bodyText ? `HTTP ${status} ${statusText}` : `HTTP ${status} ${statusText}`),
    { status, statusText, bodyText },
  );

describe('messageFromBody', () => {
  it('reads `{ error: string }` — the shape the failing install answered with', () => {
    expect(messageFromBody(INSTALL_400)).toContain('unknown field `url`');
  });

  it('reads `{ error: { message } }` and `{ message }` too', () => {
    // ⚠️ Core answers in more than one shape. Reading only the first is how a
    // body that explained the problem still rendered as a bare status line.
    expect(messageFromBody('{"error":{"message":"context not found"}}')).toBe(
      'context not found',
    );
    expect(messageFromBody('{"message":"invalid credentials"}')).toBe(
      'invalid credentials',
    );
  });

  it('keeps a short plain-text body', () => {
    expect(messageFromBody('upstream connect error')).toBe(
      'upstream connect error',
    );
  });

  it('refuses an HTML error page and a wall of text', () => {
    // Pasting a proxy's HTML or a stack trace into the card helps nobody.
    expect(messageFromBody('<html><body>502</body></html>')).toBeNull();
    expect(messageFromBody('x'.repeat(301))).toBeNull();
  });

  it('has nothing to say about an empty body', () => {
    expect(messageFromBody(undefined)).toBeNull();
    expect(messageFromBody('')).toBeNull();
    expect(messageFromBody('   ')).toBeNull();
    expect(messageFromBody('{}')).toBeNull();
  });
});

describe('statusOf', () => {
  it('reads the status off an HTTP-shaped error', () => {
    expect(statusOf(httpError(400, 'Bad Request'))).toBe(400);
  });

  it('treats 0 as no status at all', () => {
    // ⚠️ mero-js reports a refused connection / CORS / DNS failure as
    // `HTTPError(0, 'Network Error')`. Calling that a response would tell
    // someone their node refused a request it never received.
    expect(statusOf(httpError(0, 'Network Error'))).toBeNull();
    expect(statusOf(new Error('boom'))).toBeNull();
    expect(statusOf('boom')).toBeNull();
    expect(statusOf(null)).toBeNull();
  });
});

describe('describeError', () => {
  it("gives the node's own sentence, with the status in front of it", () => {
    const message = describeError(
      httpError(400, 'Bad Request', INSTALL_400),
      'Failed to install application',
    );
    expect(message).toContain('400');
    expect(message).toContain('unknown field `url`');
    expect(message).toContain('expected `package` or `version`');
    // The fallback is what the screen used to show instead of any of that.
    expect(message).not.toBe('Failed to install application');
  });

  it('falls back to the SDK message when the body says nothing', () => {
    expect(describeError(httpError(404, 'Not Found'), 'fallback')).toBe(
      'HTTP 404 Not Found',
    );
  });

  it('keeps a plain Error and a thrown string', () => {
    expect(describeError(new Error('no endpoint configured'), 'fallback')).toBe(
      'no endpoint configured',
    );
    expect(describeError('just a string', 'fallback')).toBe('just a string');
  });

  it('uses the fallback only when the throwable carried nothing', () => {
    // The case every call site used to collapse everything else into.
    expect(describeError(undefined, 'fallback')).toBe('fallback');
    expect(describeError({}, 'fallback')).toBe('fallback');
    expect(describeError(new Error('   '), 'fallback')).toBe('fallback');
  });
});

describe('isReachabilityProblem', () => {
  it('is false for a request the node answered and refused', () => {
    // ⚠️ THE WHOLE POINT. "Check that your node is running" sent the reader to
    // restart a node that had just answered — and hid the client bug it was
    // complaining about.
    expect(isReachabilityProblem(httpError(400, 'Bad Request', INSTALL_400))).toBe(
      false,
    );
    expect(isReachabilityProblem(httpError(401, 'Unauthorized'))).toBe(false);
    expect(isReachabilityProblem(httpError(404, 'Not Found'))).toBe(false);
  });

  it('is true when nothing answered, or something upstream did', () => {
    expect(isReachabilityProblem(httpError(0, 'Network Error'))).toBe(true);
    expect(isReachabilityProblem(httpError(502, 'Bad Gateway'))).toBe(true);
    expect(isReachabilityProblem(new Error('Failed to fetch'))).toBe(true);
  });
});

describe('isReachabilityMessage', () => {
  it('reads the status back out of a flattened message', () => {
    expect(isReachabilityMessage('HTTP 400: unknown field `url`')).toBe(false);
    expect(isReachabilityMessage('HTTP 400 Bad Request')).toBe(false);
    expect(isReachabilityMessage('HTTP 503 Service Unavailable')).toBe(true);
  });

  it('assumes a reachability problem when there is no status to read', () => {
    // A message with no status never reached the node, so the connectivity
    // advice is the honest default.
    expect(isReachabilityMessage('Failed to fetch')).toBe(true);
    expect(isReachabilityMessage('HTTP 0 Network Error')).toBe(true);
  });
});
