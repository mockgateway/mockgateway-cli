/**
 * The stream this CLI holds open, and the reconnecting it does quietly.
 *
 * Not EventSource: that has no way to send an Authorization header, which is
 * how the server knows whose listener this is.
 */

/**
 * Parse an event stream into {event, data} objects.
 *
 * The wire format is small enough to read directly: lines of `field: value`,
 * a blank line ends an event, a line starting with `:` is a comment — which is
 * what the server's keepalive pings are.
 */
export async function* parse(body) {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });

    let split;

    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      let event = 'message';
      const dataLines = [];

      for (const line of raw.split('\n')) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }

      if (dataLines.length === 0) continue;

      try {
        yield { event, data: JSON.parse(dataLines.join('\n')) };
      } catch {
        // A frame we cannot read is the server's problem, not something to
        // crash a long-running session over.
      }
    }
  }
}

/**
 * Stay connected, and keep handing events to the callback.
 *
 * Never throws for a dropped connection — wifi comes and goes, servers deploy,
 * and this runs for hours in a window nobody is watching. A stack trace in that
 * window reads as "the tool broke" when the truth is "your laptop slept".
 */
export async function listen({ url, token, listenerToken, onEvent, onStatus, signal }) {
  let attempt = 0;

  while (!signal.aborted) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          'X-Listener-Token': listenerToken,
        },
        signal,
      });

      // Credentials will not fix themselves by trying again, and retrying a
      // rejected token forever is how a typo becomes a support ticket.
      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => ({}));
        return { fatal: body.message ?? 'That token was rejected.' };
      }

      if (!response.ok) {
        throw new Error(`server answered ${response.status}`);
      }

      attempt = 0;
      onStatus({ connected: true });

      for await (const frame of parse(response.body)) {
        await onEvent(frame);
      }

      // The stream ended without an error: the server restarted, or another
      // session took this listener over.
      onStatus({ connected: false, reason: 'stream ended' });
    } catch (error) {
      if (signal.aborted) break;
      onStatus({ connected: false, reason: error.message });
    }

    if (signal.aborted) break;

    // Backs off to half a minute and stays there. A server that is down for an
    // hour should not be asked a thousand times.
    const waitMs = Math.min(1000 * 2 ** attempt++, 30_000);

    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        // Removed explicitly: a server down for hours means hundreds of loops,
        // and a listener left behind on each is a leak the user never sees.
        signal.removeEventListener('abort', done);
        resolve();
      };

      const timer = setTimeout(done, waitMs);
      signal.addEventListener('abort', done, { once: true });
    });
  }

  return {};
}
