/**
 * What the terminal says.
 *
 * This is most of what anyone experiences of the feature: a window left open
 * on a second monitor, glanced at while debugging something else. So a line
 * has to be readable sideways, and a failure has to say what to do about it
 * rather than what threw.
 */

// Colour only when someone is actually watching. Piped into a file or a CI log,
// escape codes are noise.
const tty = process.stdout.isTTY;
const paint = (code, text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);

export const dim = (t) => paint('2', t);
export const green = (t) => paint('32', t);
export const red = (t) => paint('31', t);
export const yellow = (t) => paint('33', t);
export const bold = (t) => paint('1', t);

const clock = () =>
  new Date().toLocaleTimeString('en-GB', { hour12: false });

export function info(message) {
  process.stdout.write(`${message}\n`);
}

export function banner({ forwardTo, webhookUrl }) {
  info('');
  info(`${green('✓')} Connected to MockGateway`);
  info(`${green('✓')} Forwarding to ${bold(forwardTo)}`);
  info('');
  info('  Webhook URL (paste into your gateway settings):');
  info(`  ${bold(webhookUrl)}`);
  info('');
  info(dim('  Waiting for events... (Ctrl+C to stop)'));
  info('');
}

/**
 * Pad to a column, keeping at least one space after an overlong value.
 *
 * Padding alone lets a long event name run straight into the arrow, and the
 * columns are the reason this output is readable at a glance. Colour has to be
 * applied after padding, too — escape codes count toward string length and
 * would otherwise eat the column.
 */
const column = (text, width) => text.padEnd(width) + (text.length >= width ? ' ' : '');

export function delivered(event, statusCode, durationMs) {
  const ok = statusCode >= 200 && statusCode < 300;
  const mark = ok ? green('→') : red('→');
  const status = column(ok ? `${statusCode} OK` : `${statusCode}`, 10);

  info(`${dim(clock())}  ${column(event, 18)}${mark} ${ok ? green(status) : red(status)}${dim(`${durationMs}ms`)}`);
}

/**
 * A failure the user can act on.
 *
 * ECONNREFUSED is the one that happens constantly — the app is not running, or
 * it is on another port — and a Node stack trace for it tells them nothing they
 * can use.
 */
export function failed(event, error, forwardTo) {
  const port = (() => {
    try { return new URL(forwardTo).port || '80'; } catch { return '?'; }
  })();

  const explained = {
    ECONNREFUSED: `connection refused — is your app running on :${port}?`,
    ENOTFOUND: 'host not found — check the --forward-to URL',
    ETIMEDOUT: 'timed out — your app did not answer in time',
    ABORT_ERR: 'timed out — your app did not answer in time',
  }[error.code ?? error.name] ?? error.message;

  info(`${dim(clock())}  ${column(event, 18)}${red('✗')} ${red(explained)}`);
}

export function notice(message) {
  info(`${dim(clock())}  ${yellow(message)}`);
}

export function reconnected() {
  info(`${dim(clock())}  ${green('Reconnected — listening again.')}`);
}

export function fatal(message, hint) {
  process.stderr.write(`\n${red('✗')} ${message}\n`);
  if (hint) process.stderr.write(`${dim(`  ${hint}`)}\n`);
  process.stderr.write('\n');
  process.exit(1);
}
