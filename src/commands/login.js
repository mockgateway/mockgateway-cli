import { apiUrl, configPath, write } from '../config.js';
import { bold, dim, fatal, green, info } from '../output.js';

/**
 * Pasted rather than obtained through a browser — works over SSH, and a device
 * flow would need an approval page without changing what `listen` does.
 */
export async function login(args) {
  const token = args['--token'];

  if (!token) {
    fatal('A token is required.',
      'Create one under Settings → CLI, then run:\n     mockgateway login --token <token>');
  }

  // Checked now: a typo found here costs a second, found by `listen` it looks
  // like the stream is broken.
  const response = await fetch(`${apiUrl()}/api/v1/cli/listeners`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  }).catch((error) => fatal(`Could not reach ${apiUrl()}`, error.message));

  if (response.status === 401) {
    fatal('That token was rejected.', 'Create a new one under Settings → CLI.');
  }

  if (!response.ok) {
    fatal(`${apiUrl()} answered ${response.status}.`);
  }

  write({ token, api_url: apiUrl() });

  info('');
  info(`${green('✓')} Signed in. Token saved to ${bold(configPath)}`);
  info('');
  info(dim('  Next:  mockgateway listen --forward-to http://localhost:3000/webhook'));
  info('');
}
