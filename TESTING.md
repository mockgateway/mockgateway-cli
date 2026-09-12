# Testing the CLI locally

Before publishing to npm, test it the way a customer will use it — **globally
installed**, not `node src/index.js`. The two differ in the `bin` shim, the
shebang, the file list and the working directory.

## 0. Stack up

```bash
cd docker
docker compose up -d
docker compose exec simulation-app php artisan migrate
docker compose exec simulation-app php artisan mockgateway:setup-webhook-queues --force
docker logs simulation-relay --tail 3          # expect relay_started
```

`codes/.env` and `docker/.envs/relay.env` must carry the **same**
`CLI_RELAY_SECRET`, or the relay refuses to start.

## 1. Unit tests

```bash
cd cli   && npm test                            # 7 tests
cd relay && npm test                            # 8 tests

docker exec simulation-app php artisan test --filter="Cli|Webhook"
```

Never run the full `php artisan test` — it wipes the dev database.

## 2. Install it as a package

`npm link` is the development loop: a global symlink to the working tree, so
edits take effect without reinstalling.

```bash
cd cli
npm link
which mockgateway        # …/bin/mockgateway
mockgateway              # help
```

To test exactly what npm will ship instead:

```bash
cd cli
npm pack                                        # mockgateway-cli-1.0.0.tgz
npm install -g ./mockgateway-cli-1.0.0.tgz
```

`npm pack` also prints the file list — check nothing unwanted is in it.

## 3. Point it at the local stack

```bash
export MOCKGATEWAY_API_URL=http://localhost:9501
```

Without this it talks to production. Put it in the shell you test from.

Get a token from **http://localhost:9501/settings/cli** → "Create a CLI token".

```bash
mockgateway login --token '<token>'
cat ~/.mockgateway/config.json                  # token + api_url, mode 600
```

## 4. The happy path — three terminals

**Terminal 1** — a receiver that prints what arrives:

```bash
node -e "require('http').createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{console.log(q.headers['content-type'],q.headers['x-signature'],b.slice(0,120));s.end('OK')})}).listen(4599)"
```

**Terminal 2**:

```bash
export MOCKGATEWAY_API_URL=http://localhost:9501
mockgateway listen --forward-to http://localhost:4599/webhook
```

**Terminal 3**:

```bash
export MOCKGATEWAY_API_URL=http://localhost:9501
mockgateway trigger
mockgateway logs
```

Expect `→ 200 OK` in terminal 2, the real payload in terminal 1.

Then run a **real payment** against the gateway whose webhook points at the
listener URL — `trigger` and a payment take different paths into the queue, and
only the payment exercises the signature the provider actually sends.

## 5. Failure paths

These are most of what a user experiences, so test them deliberately.

| Do this | Expect |
| ------- | ------ |
| Stop terminal 1, then `trigger` | `✗ connection refused — is your app running on :4599?` |
| Stop the CLI, then `trigger` | `"default" has no CLI connected.` |
| `mockgateway listen` again in a 4th terminal | terminal 2 exits with "claimed by another session" |
| `docker restart simulation-relay` | CLI reconnects quietly, no stack trace |
| Turn wifi off and on | same |
| `mockgateway login --token bogus` | `✗ That token was rejected.` |
| Ctrl+C mid-delivery | finishes in-flight, then exits |
| `mockgateway trigger --gateway nope` | `You have no gateway called "nope".` |

No stack traces anywhere. A Node stack trace in a user's terminal is a bug.

## 6. The dashboard

- `/settings/cli` — green dot while listening, grey after Ctrl+C (up to 90s lag)
- `/webhooks/logs` — CLI badge, and the URL shown is `localhost:4599`, not `/cli/l_…`
- `/webhooks/create` — listener chips; picking one disables the retry toggle
- `/` — the "Webhooks on localhost" section

## 7. Fresh-machine check

The most common publish bug is code that only works in the repo.

```bash
npm uninstall -g mockgateway-cli
cd /tmp && rm -rf ~/.mockgateway
npm install -g /path/to/mockgateway-cli-1.0.0.tgz
mockgateway listen --forward-to http://localhost:4599/webhook
```

Run it from `/tmp`, not from the repo — anything resolved relative to the
working directory fails here and nowhere else.

## 8. Clean up

```bash
npm unlink -g mockgateway-cli      # or: npm uninstall -g mockgateway-cli
rm -f cli/mockgateway-cli-*.tgz
```

## Before publishing

1. `DEFAULT_API_URL` in `src/config.js` is the real production domain
2. The relay is deployed and live — otherwise every install fails at `listen`
3. Version number is what you mean (`1.0.0` promises a stable API)

Publishing is irreversible: a version number is taken forever, and unpublish
stops being possible after 24 hours.

```bash
cd cli && npm login && npm publish
```
