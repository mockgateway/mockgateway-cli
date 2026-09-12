import { claimListener, closeListener, reportResult } from '../api.js';
import { apiUrl, token } from '../config.js';
import { forward } from '../forward.js';
import { banner, delivered, failed, fatal, notice } from '../output.js';
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
    fatal('Not signed in.', 'Run: mockgateway login --token <token>');
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

  const handle = async (frame) => {
    const work = (async () => {
      const result = await forward(frame, forwardTo);

      result.error
        ? failed(frame.event, result._error ?? new Error(result.error), forwardTo)
        : delivered(frame.event, result.status_code, result.duration_ms);

      await reportResult(listener.token, frame.webhook_log_id, result);
    })();

    inFlight.add(work);

    try {
      await work;
    } finally {
      inFlight.delete(work);
    }
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

    controller.abort();
    await closeListener(listener.id);

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

    onEvent: async ({ event, data }) => {
      if (event === 'delivery') return handle(data);

      if (event === 'superseded') {
        fatal(data.message, 'Only one `mockgateway listen` can hold a listener at a time.');
      }

      if (event === 'shutdown') {
        notice(data.message ?? 'Server restarting — reconnecting.');
      }
    },

    onStatus: ({ connected, reason }) => {
      if (!connected && reason && !stopping) {
        notice(`Disconnected (${reason}) — reconnecting...`);
      }
    },
  });

  if (reason) {
    fatal(reason, 'Run: mockgateway login --token <token>');
  }
}
