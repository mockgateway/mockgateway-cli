import { apiUrl, token } from './config.js';
import { fatal } from './output.js';

const authHeaders = () => ({
  Accept: 'application/json',
  Authorization: `Bearer ${token()}`,
});

async function call(path, options = {}) {
  const base = apiUrl();

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers ?? {}) },
  }).catch((error) => fatal(`Could not reach ${base}`, error.message));

  if (response.status === 401) {
    fatal('That token was rejected.', 'Run: mockgateway login --token <token>');
  }

  return response;
}

export async function json(path, options) {
  const response = await call(path, options);
  const body = await response.json().catch(() => ({}));

  return { ok: response.ok, status: response.status, body };
}

export async function post(path, payload) {
  return json(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function listeners() {
  const { ok, body } = await json('/api/v1/cli/listeners');

  return ok ? body.listeners ?? [] : [];
}

/** Reusing a label is the point: the URL pasted yesterday still works today. */
export async function claimListener(label) {
  const { ok, status, body } = await post('/api/v1/cli/listeners', { label });

  if (!ok) {
    fatal(`Could not start a listener — the server answered ${status}.`);
  }

  return body.listener;
}

export async function closeListener(id) {
  await call(`/api/v1/cli/listeners/${id}`, { method: 'DELETE' }).catch(() => {});
}

/**
 * Reported to the relay, not the app: the relay still holds the message and is
 * what decides whether a required acknowledgement was given.
 */
export async function reportResult(listenerToken, webhookLogId, result) {
  const { _error, ...body } = result;

  try {
    await fetch(`${apiUrl()}/cli/deliveries/${webhookLogId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Listener-Token': listenerToken },
      body: JSON.stringify(body),
    });
  } catch {
    // The delivery happened; the server times this out on its own.
  }
}
