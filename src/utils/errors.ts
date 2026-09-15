/**
 * Turning a thrown thing into something a person can act on.
 *
 * ⚠️ THE FAILURE THIS EXISTS FOR. Installing an application answered
 *
 *   HTTP 400 Bad Request
 *   If the problem persists, check that your node is running and reachable.
 *
 * while the node was running, reachable, and had just explained itself in
 * detail:
 *
 *   {"error":"Invalid JSON data: Failed to deserialize the JSON body into the
 *    target type: url: unknown field `url`, expected `package` or `version`"}
 *
 * Both halves of that screen were wrong. The message threw away the only
 * sentence that said what to fix, and the hint below it sent the reader to
 * check a node that had answered in milliseconds — so the actual bug (a client
 * sending a field core deleted) was invisible from the UI and stayed that way.
 *
 * ⚠️ AND IT IS NOT ONE CALLER'S BUG. Fourteen call sites wrote
 * `err instanceof Error ? err.message : 'Something failed'` by hand, so every
 * one of them decided separately how much of the node's answer to keep, and a
 * non-Error throwable dropped the whole thing at all of them.
 */

/**
 * Pull the node's own words out of a response body.
 *
 * ⚠️ FOUR SHAPES, BECAUSE CORE ANSWERS IN FOUR SHAPES. `{"error":"..."}` is
 * what the extractor rejection above uses; `{"error":{"message":"..."}}` is
 * what the admin API's structured failures use; `{"message":"..."}` comes off
 * the auth service; and a proxy or a panic answers plain text with no JSON at
 * all. Reading only the first is how a body that explained the problem
 * perfectly still rendered as a bare status line.
 */
export function messageFromBody(bodyText?: string | null): string | null {
  if (!bodyText) return null;

  const trimmed = bodyText.trim();
  if (trimmed === '') return null;

  try {
    const body = JSON.parse(trimmed);
    const candidates = [
      typeof body?.error === 'string' ? body.error : null,
      typeof body?.error?.message === 'string' ? body.error.message : null,
      typeof body?.message === 'string' ? body.message : null,
    ];
    const hit = candidates.find((c) => c && c.trim() !== '');
    if (hit) return hit.trim();
    return null;
  } catch {
    // Not JSON. A short plain-text body is still the best answer we have; a
    // long one is a stack trace or an HTML error page, and pasting either into
    // a card helps nobody.
    if (trimmed.length <= 300 && !trimmed.startsWith('<')) return trimmed;
    return null;
  }
}

/** An error carrying an HTTP response, as mero-js's `HTTPError` does. */
interface HttpShaped {
  status?: unknown;
  statusText?: unknown;
  bodyText?: unknown;
}

function asHttpShaped(err: unknown): HttpShaped | null {
  return err !== null && typeof err === 'object' ? (err as HttpShaped) : null;
}

/** The HTTP status an error carries, if it carries one. */
export function statusOf(err: unknown): number | null {
  const status = asHttpShaped(err)?.status;
  // ⚠️ 0 IS NOT A STATUS. mero-js reports a transport failure — DNS, refused
  // connection, CORS — as `HTTPError(0, 'Network Error')`, and treating that
  // as a real response is what would tell someone their node had refused a
  // request it never received.
  return typeof status === 'number' && status > 0 ? status : null;
}

/**
 * The most specific description of a failure we can honestly give.
 *
 * The node's own sentence when there is one, the status alongside it so the
 * reader can tell a refused request from a dead one, and the caller's fallback
 * only when the throwable carried nothing at all.
 */
export function describeError(err: unknown, fallback: string): string {
  const http = asHttpShaped(err);
  const status = statusOf(err);
  const fromBody = messageFromBody(
    typeof http?.bodyText === 'string' ? http.bodyText : null,
  );

  if (fromBody) {
    return status ? `HTTP ${status}: ${fromBody}` : fromBody;
  }

  // mero-js >= 18 already folds the body into `message` as
  // `HTTP <status> <text>: <explanation>`, so an Error that has been through
  // the SDK usually arrives complete. Anything it could not parse falls
  // through to the status line, which is still better than the fallback
  // because it says whether the request was answered at all.
  if (err instanceof Error && err.message.trim() !== '') return err.message;
  if (typeof err === 'string' && err.trim() !== '') return err.trim();

  return fallback;
}

/**
 * Is this failure plausibly about reaching the node?
 *
 * ⚠️ THE POINT OF THE QUESTION. "Check that your node is running and
 * reachable" is good advice for a refused connection and actively misleading
 * for a 400 — it sends the reader to restart a node that just answered, and
 * buries the client bug the node was complaining about. So the hint is shown
 * only where it could be true: no status at all (the request never landed), or
 * a 5xx/502-class answer from something in front of the node.
 */
export function isReachabilityProblem(err: unknown): boolean {
  const status = statusOf(err);
  if (status === null) return true;
  return status >= 500;
}

/**
 * The same question asked of a message that has already been flattened to a
 * string, for the components that keep `error: string | null` in state.
 *
 * ⚠️ COUPLED TO `describeError`'s OUTPUT ON PURPOSE, and to mero-js's
 * `HTTPError.message` format, which is the same `HTTP <status>` opening. This
 * is the price of the string-shaped error state the app already had; the
 * alternative was rewriting fourteen components to carry the error object, in
 * the change that is meant to make one screen readable.
 */
export function isReachabilityMessage(message: string): boolean {
  const match = /^HTTP (\d{3})\b/.exec(message.trim());
  if (!match) return true;
  return Number(match[1]) >= 500;
}
