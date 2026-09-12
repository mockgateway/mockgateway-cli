import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(os.homedir(), '.mockgateway');
const FILE = path.join(DIR, 'config.json');

export const DEFAULT_API_URL = 'https://mockgateway.com';

export function apiUrl() {
  // Overridable so the CLI works against a self-hosted install, and so the
  // people building this can point it at their own machine.
  const stored = read().api_url;

  return (process.env.MOCKGATEWAY_API_URL ?? stored ?? DEFAULT_API_URL).replace(/\/$/, '');
}

export function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function write(values) {
  fs.mkdirSync(DIR, { recursive: true });

  // The token is an account credential, so the file is the user's own and
  // nobody else's — the same treatment an SSH key or a netrc gets.
  fs.writeFileSync(FILE, JSON.stringify({ ...read(), ...values }, null, 2), { mode: 0o600 });
}

export function token() {
  return process.env.MOCKGATEWAY_TOKEN ?? read().token ?? null;
}

export const configPath = FILE;
