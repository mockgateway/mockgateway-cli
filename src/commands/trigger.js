import { listeners, post } from '../api.js';
import { token } from '../config.js';
import { dim, fatal, green, info } from '../output.js';

/**
 * Send one webhook without clicking through a checkout first.
 */
export async function trigger(args) {
  if (!token()) {
    fatal('Not signed in.', "Run: mockgateway login --token '<token>'");
  }

  const label = args['--label'] ?? 'default';
  const open = await listeners();
  const listener = open.find((l) => l.label === label) ?? open[0];

  if (!listener) {
    fatal('No listener to send to.',
      'Start one first:  mockgateway listen --forward-to http://localhost:3000/webhook');
  }

  // Said now, rather than letting the webhook fail a second later for a reason
  // that lives in another window.
  if (!listener.live) {
    fatal(`"${listener.label}" has no CLI connected.`,
      'Run `mockgateway listen` in another terminal, then trigger again.');
  }

  const { ok, status, body } = await post('/api/v1/cli/trigger', {
    listener_token: listener.token,
    gateway: args['--gateway'],
    scenario: args['--scenario'],
  });

  if (!ok) {
    fatal(body.message ?? `Server answered ${status}.`,
      body.available ? `Available scenarios: ${body.available.join(', ')}` : undefined);
  }

  info('');
  info(`${green('✓')} Sent ${body.gateway}${body.scenario ? ` · ${body.scenario}` : ''}`);
  info(dim('  Watch the listening terminal for the result.'));
  info('');
}
