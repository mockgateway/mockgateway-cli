import { json } from '../api.js';
import { token } from '../config.js';
import { dim, fatal, green, info, red } from '../output.js';

export async function logs(args) {
  if (!token()) {
    fatal('Not signed in.', "Run: mockgateway login --token '<token>'");
  }

  const limit = Number.parseInt(args['--limit'] ?? '10', 10) || 10;
  const { ok, status, body } = await json(`/api/v1/cli/deliveries?limit=${limit}`);

  if (!ok) {
    fatal(`Server answered ${status}.`);
  }

  const deliveries = body.deliveries ?? [];

  info('');

  if (!deliveries.length) {
    info(dim('  No CLI deliveries yet.'));
    info('');
    return;
  }

  for (const d of deliveries) {
    const at = new Date(d.created_at).toLocaleString('en-GB', { hour12: false });

    const outcome = d.status === 'success'
      ? green(`${d.response} OK`)
      : red(d.error ? d.error.slice(0, 48) : (d.status ?? 'unknown'));

    info(`  ${dim(at)}  ${(d.action ?? '').padEnd(22)} ${outcome}`);

    if (d.forwarded_to) {
      info(`  ${' '.repeat(at.length)}  ${dim(d.forwarded_to)}`);
    }
  }

  info('');
}
