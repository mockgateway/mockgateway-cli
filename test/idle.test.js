import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';

// Read before importing: the module reads it once, at load.
process.env.SSE_IDLE_TIMEOUT_MS = '400';

const { listen } = await import('../src/sse.js');

/**
 * A stream that opens, says hello, then goes quiet forever — the shape a socket
 * takes after a laptop sleeps or a router drops it without sending anything.
 * Nothing errors, so only a watchdog can notice.
 */
function silentServer() {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('event: ready\ndata: {}\n\n');
  });
}

test('a stream that goes silent is dropped and retried', async () => {
  const server = silentServer();
  let opened = 0;
  server.on('request', () => opened++);

  await new Promise((r) => server.listen(0, r));

  const controller = new AbortController();
  const statuses = [];

  const run = listen({
    url: `http://127.0.0.1:${server.address().port}/cli/stream`,
    token: 't',
    listenerToken: 'l_x',
    onEvent: () => {},
    onStatus: (s) => statuses.push(s),
    signal: controller.signal,
  });

  await new Promise((r) => setTimeout(r, 2000));
  controller.abort();
  await run;
  await new Promise((r) => server.close(r));

  // Without the watchdog this would sit on the first connection forever.
  assert.ok(opened > 1, `expected a retry, got ${opened} connection(s)`);

  const dropped = statuses.find((s) => s.connected === false);
  assert.ok(dropped, 'reported the drop');
  assert.match(dropped.reason, /no data/);
});

test('a stream that keeps pinging is left alone', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('event: ready\ndata: {}\n\n');
    const ping = setInterval(() => res.write(': ping\n\n'), 150);
    res.on('close', () => clearInterval(ping));
  });

  let opened = 0;
  server.on('request', () => opened++);

  await new Promise((r) => server.listen(0, r));

  const controller = new AbortController();
  const run = listen({
    url: `http://127.0.0.1:${server.address().port}/cli/stream`,
    token: 't',
    listenerToken: 'l_x',
    onEvent: () => {},
    onStatus: () => {},
    signal: controller.signal,
  });

  await new Promise((r) => setTimeout(r, 2000));
  controller.abort();
  await run;
  await new Promise((r) => server.close(r));

  // Pings carry no data and never become events, so they only keep the
  // connection alive if the watchdog counts them.
  assert.equal(opened, 1, 'stayed on one connection');
});
