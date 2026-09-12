#!/usr/bin/env node

import { listenCommand } from './commands/listen.js';
import { login } from './commands/login.js';
import { logs } from './commands/logs.js';
import { trigger } from './commands/trigger.js';
import { apiUrl } from './config.js';
import { bold, dim, fatal, info } from './output.js';

/**
 * Arguments, without a dependency.
 *
 * Two commands and four flags do not need a parser, and a CLI people install
 * globally is better off with no supply chain at all.
 */
function parse(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;

    const [flag, inline] = argv[i].split('=');

    if (inline !== undefined) {
      args[flag] = inline;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[flag] = argv[++i];
    } else {
      args[flag] = true;
    }
  }

  return args;
}

function usage() {
  info('');
  info(bold('  mockgateway') + ' — receive webhooks on localhost, without a tunnel');
  info('');
  info('  ' + bold('login') + '   --token <token>');
  info(dim('            Store the token from Settings → CLI.'));
  info('');
  info('  ' + bold('listen') + '  --forward-to <url> [--label <name>]');
  info(dim('            Hold a connection open and forward webhooks to <url>.'));
  info('');
  info('  ' + bold('trigger') + ' [--gateway <slug>] [--scenario <name>] [--label <name>]');
  info(dim('            Send one webhook now, without running a payment.'));
  info('');
  info('  ' + bold('logs') + '    [--limit <n>]');
  info(dim('            What was delivered recently.'));
  info('');
  info(dim(`  Server: ${apiUrl()}`));
  info(dim('  Override with MOCKGATEWAY_API_URL for a self-hosted install.'));
  info('');
}

const [command, ...rest] = process.argv.slice(2);
const args = parse(rest);

const run = {
  login,
  listen: listenCommand,
  trigger,
  logs,
}[command];

if (!run) {
  usage();
  process.exit(command === undefined || command === '--help' ? 0 : 1);
}

run(args).catch((error) => {
  fatal(error.message);
});
