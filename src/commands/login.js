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
      "Create one under Settings → CLI, then run:\n     mockgateway login --token '<token>'");
  }

  // A token is always id|hash. Missing the pipe means the shell split it, and
  // the CLI only ever saw the digits — "rejected" would be a useless answer.
  if (!String(token).includes('|')) {
    fatal('That looks like only part of a token.',
      "Your shell split it on the | character. Wrap it in quotes:\n" +
      "     mockgateway login --token '7|jvKBKapUh...'");
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
