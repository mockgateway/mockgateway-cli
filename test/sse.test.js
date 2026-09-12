import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parse } from '../src/sse.js';

/** Feeds the parser raw bytes, split wherever the caller says. */
async function collect(...chunks) {
  const encoder = new TextEncoder();

  const body = (async function* () {
    for (const chunk of chunks) yield encoder.encode(chunk);
  })();

  const events = [];

  for await (const event of parse(body)) events.push(event);

  return events;
}

test('reads one event', async () => {
  const events = await collect('event: delivery\ndata: {"id":1}\n\n');

  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'delivery');
  assert.equal(events[0].data.id, 1);
});

test('reads several events from one chunk', async () => {
  const events = await collect(
    'event: delivery\ndata: {"id":1}\n\nevent: delivery\ndata: {"id":2}\n\n',
  );

  assert.deepEqual(events.map((e) => e.data.id), [1, 2]);
});

// The one that matters: TCP splits wherever it likes, and an event arriving in
// two reads must not be lost or truncated.
test('reassembles an event split across chunks', async () => {
  const events = await collect('event: delivery\nda', 'ta: {"id":', '7}\n\n');

  assert.equal(events.length, 1);
  assert.equal(events[0].data.id, 7);
});

test('ignores keepalive comments', async () => {
  const events = await collect(': ping\n\n', 'event: delivery\ndata: {"id":1}\n\n', ': ping\n\n');

  assert.equal(events.length, 1);
});

test('a frame with no data is not an event', async () => {
  assert.equal((await collect('event: ready\n\n')).length, 0);
});

test('malformed JSON does not end the stream', async () => {
  const events = await collect('event: delivery\ndata: {oops\n\n', 'event: delivery\ndata: {"id":2}\n\n');

  assert.equal(events.length, 1);
  assert.equal(events[0].data.id, 2);
});

test('an event without a name defaults to message', async () => {
  assert.equal((await collect('data: {"id":1}\n\n'))[0].event, 'message');
});
