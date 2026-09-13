#!/usr/bin/env node

/**
 * A webhook receiver that shows you what arrived.
 *
 * Not shipped — see "files" in package.json. This is for testing the CLI.
 *
 *   node dev/receiver.js                 listen on 4599, answer 200
 *   node dev/receiver.js --port 3000
 *   node dev/receiver.js --status 500    answer 500, to test a failing handler
 *   node dev/receiver.js --slow 35       delay 35s, to test the CLI timeout
 *   node dev/receiver.js --ack '[accepted]'   echo what Adyen-style gateways want
 */

import http from 'node:http';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const port = Number(arg('port', 4599));
const status = Number(arg('status', 200));
const slowSeconds = Number(arg('slow', 0));
const ack = arg('ack', 'OK');

const tty = process.stdout.isTTY;
const paint = (code, text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = (t) => paint('2', t);
const bold = (t) => paint('1', t);
const green = (t) => paint('32', t);
const red = (t) => paint('31', t);
const cyan = (t) => paint('36', t);
const yellow = (t) => paint('33', t);

// The headers worth pulling out of the noise: whichever one carries the
// provider's signature is the whole reason for testing against a mock.
const INTERESTING = /^(content-type|user-agent|authorization|x-.*sig.*|.*-signature|x-api-key|x-.*-token|paypal-.*|stripe-.*)$/i;

const line = () => console.log(dim('─'.repeat(72)));

function showBody(raw, contentType) {
  if (!raw) return console.log(dim('  (empty body)'));

  if (contentType.includes('json')) {
    try {
      console.log(
        JSON.stringify(JSON.parse(raw), null, 2)
          .split('\n')
          .map((l) => '  ' + l)
          .join('\n')
      );
      return;
    } catch {
      console.log(yellow('  Content-Type says JSON, but this does not parse:'));
    }
  }

  if (contentType.includes('x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    const width = Math.max(...[...params.keys()].map((k) => k.length), 0);

    for (const [key, value] of params) {
      console.log(`  ${cyan(key.padEnd(width))}  ${value}`);
    }
    return;
  }

  console.log('  ' + raw.replace(/\n/g, '\n  '));
}

function showHeaders(headers) {
  const keys = Object.keys(headers).sort();
  const shown = keys.filter((k) => INTERESTING.test(k));
  const width = Math.max(...shown.map((k) => k.length), 0);

  for (const key of shown) {
    console.log(`  ${dim(key.padEnd(width))}  ${headers[key]}`);
  }

  const rest = keys.length - shown.length;
  if (rest > 0) console.log(dim(`  … and ${rest} more header(s)`));
}

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));

    req.on('end', async () => {
      const contentType = req.headers['content-type'] ?? '';
      const at = new Date().toLocaleTimeString('en-GB', { hour12: false });

      console.log('');
      line();
      console.log(`${bold(req.method)} ${req.url}   ${dim(at)}   ${dim(`${raw.length} bytes`)}`);
      line();

      showHeaders(req.headers);
      console.log('');
      showBody(raw, contentType);

      if (slowSeconds > 0) {
        console.log(dim(`\n  holding the response for ${slowSeconds}s...`));
        await new Promise((r) => setTimeout(r, slowSeconds * 1000));
      }

      const colour = status >= 200 && status < 300 ? green : red;
      console.log(`\n${colour(`→ answering ${status}`)} ${dim(`"${ack}"`)}`);

      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(ack);
    });
  })
  .listen(port, () => {
    console.log('');
    console.log(`${green('✓')} Webhook receiver on ${bold(`http://localhost:${port}`)}`);
    console.log(dim(`  answering ${status} with "${ack}"${slowSeconds ? `, after ${slowSeconds}s` : ''}`));
    console.log(dim('  Ctrl+C to stop'));
  });
