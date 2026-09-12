/**
 * The only part of this that touches the user's own application.
 *
 * The request is sent exactly as it was handed over — headers included, the
 * signature header among them. That is the point: the customer is testing their
 * own verification code, and a webhook that arrived with headers this tool
 * invented would prove nothing about the one their provider will send.
 */
export async function forward(frame, forwardTo, timeoutMs = 30_000) {
  const started = Date.now();

  // AbortSignal.timeout exists from Node 17.3; the explicit controller keeps
  // the error shape the same across versions.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const hasBody = !['GET', 'DELETE'].includes(frame.method);

    const response = await fetch(forwardTo, {
      method: frame.method,
      headers: frame.headers,
      body: hasBody ? frame.body : undefined,
      signal: controller.signal,
    });

    const body = await response.text();

    return {
      status_code: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      // Capped: some frameworks answer a webhook with a full HTML error page,
      // and none of it past the first part helps anyone.
      body: body.slice(0, 64 * 1024),
      duration_ms: Date.now() - started,
      forwarded_to: forwardTo,
    };
  } catch (error) {
    const code = error.code ?? error.name;

    return {
      error: code === 'AbortError' || code === 'ABORT_ERR'
        ? `No response within ${Math.round(timeoutMs / 1000)}s`
        : (error.cause?.code ?? error.message),
      duration_ms: Date.now() - started,
      forwarded_to: forwardTo,
      // Kept for the terminal line, which explains ECONNREFUSED rather than
      // printing it.
      _error: error.cause ?? error,
    };
  } finally {
    clearTimeout(timer);
  }
}
