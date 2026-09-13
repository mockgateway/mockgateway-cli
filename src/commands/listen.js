import { claimListener, reportResult } from '../api.js';
import { apiUrl, token } from '../config.js';
import { forward } from '../forward.js';
import { banner, delivered, failed, fatal, notice, reconnected } from '../output.js';
import { listen as openStream } from '../sse.js';

function validate(forwardTo) {
  if (!forwardTo) {
    fatal('--forward-to is required.',
      'Example:  mockgateway listen --forward-to http://localhost:3000/webhook');
  }

  try {
    new URL(forwardTo);
  } catch {
    fatal(`"${forwardTo}" is not a URL.`, 'Example:  http://localhost:3000/webhook');
  }

  if (!token()) {
    fatal('Not signed in.', "Run: mockgateway login --token '<token>'");
  }
}

export async function listenCommand(args) {
  const forwardTo = args['--forward-to'];

  validate(forwardTo);

  const listener = await claimListener(args['--label'] ?? 'default');

  banner({ forwardTo, webhookUrl: listener.webhook_url });

  const controller = new AbortController();
  const inFlight = new Set();
  let stopping = false;
  let dropped = false;

  // Started, not awaited. Awaiting here would stop the stream being read until
  // the receiver answered, so a burst would queue behind a slow handler — and
  // the server, which times a delivery out after 30s, would record webhooks as
  // failed that this is about to deliver perfectly well.
  const handle = (frame) => {
    const work = (async () => {
      const result = await forward(frame, forwardTo);

      result.error
        ? failed(frame.event, result._error ?? new Error(result.error), forwardTo)
        : delivered(frame.event, result.status_code, result.duration_ms);

      await reportResult(listener.token, frame.webhook_log_id, result);
    })();

    inFlight.add(work);

    // Tracked so Ctrl+C can wait for it; failures are already reported inside.
    work.catch(() => {}).finally(() => inFlight.delete(work));
  };

  // Ctrl+C waits: the webhook already left the server, and exiting mid-flight
  // leaves it with no answer until it times out.
  const stop = async () => {
    if (stopping) return;
    stopping = true;

    if (inFlight.size) {
      notice(`Finishing ${inFlight.size} delivery(s)...`);
      await Promise.allSettled([...inFlight]);
    }

    // The listener is left in place. Deleting it on exit would hand out a new
    // URL next time, which is the exact thing a tunnel does and this does not —
    // and Ctrl+C is the ordinary way to stop, not an act of decommissioning.
    // Closing the stream is enough: the relay sees the disconnect at once.
    controller.abort();

    process.stdout.write('\n');
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  const { fatal: reason } = await openStream({
    url: `${apiUrl()}/cli/stream`,
    token: token(),
    listenerToken: listener.token,
    signal: controller.signal,

    onEvent: ({ event, data }) => {
      if (event === 'delivery') return handle(data);

      if (event === 'superseded') {
        fatal(data.message, 'Only one `mockgateway listen` can hold a listener at a time.');
      }

      if (event === 'shutdown') {
        notice(data.message ?? 'Server restarting — reconnecting.');
      }
    },

    // Silence after a run of "disconnected" lines is indistinguishable from
    // having given up, so a recovery has to say so. Only after a visible
    // disconnect — the banner already announces the first connection.
    onStatus: ({ connected, reason }) => {
      if (stopping) return;

      if (!connected && reason) {
        dropped = true;
        notice(`Disconnected (${reason}) — reconnecting...`);
        return;
      }

      if (connected && dropped) {
        dropped = false;
        reconnected();
      }
    },
  });

  if (reason) {
    fatal(reason, "Run: mockgateway login --token '<token>'");
  }
}
