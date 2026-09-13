# mockgateway-cli

**Receive payment webhooks on `localhost` — no tunnel, no new URL every restart.**

[MockGateway](https://mockgateway.com) is a payment gateway simulator: it lets
you build and test payment integrations against a fake Stripe, PayPal,
Braintree, or any other gateway, without touching a real payment provider.
This CLI is how its webhooks reach your machine while you develop — your
computer opens a connection outward to MockGateway and holds it open, so a
webhook that would normally need a public URL can land on `localhost` instead.

```bash
npm install -g mockgateway-cli
mockgateway login --token '<token>'
mockgateway listen --forward-to http://localhost:3000/webhook
```

```
✓ Connected to MockGateway
✓ Forwarding to http://localhost:3000/webhook

  Webhook URL (paste into your gateway settings):
  https://mockgateway.com/cli/l_7fK2pQ9xR4mN8wZ

14:22:07  payment.success   → 200 OK     42ms
14:22:19  payment.failed    → 200 OK     31ms
14:22:31  refund.completed  ✗ connection refused — is your app running on :3000?
```

## Why not just use a tunnel?

Every webhook-testing workflow starts the same way: expose `localhost`, paste
the URL into a dashboard, test, and repeat tomorrow after the tunnel gave you
a new address. That last part is the annoying one.

| | ngrok / a tunnel | mockgateway-cli |
| --- | --- | --- |
| Account needed | yes, a separate one | no — uses your MockGateway login |
| URL changes | every restart | never |
| Update webhook settings | every time the URL changes | once |
| Machine reachable from the internet | yes | no |
| Delivery log | separate dashboard | right in your terminal |

The stable URL is the whole point. `mockgateway listen` run today and run
again next month hands back the exact same address, because the identity is a
label on your account, not a socket that just happened to get one.

## How it works

Your machine can't be reached from MockGateway's servers — it's behind NAT, a
firewall, or it's simply a laptop that isn't always on. So the connection runs
the other way: the CLI opens a stream *to* MockGateway and holds it open.
When a webhook fires, MockGateway pushes it down that stream, and the CLI
makes the HTTP request to your `--forward-to` URL itself, from inside your
own network.

```
MockGateway  ── holds the connection open ──▶  mockgateway-cli
                                                      │
                                                      ▼
                                            http://localhost:3000/webhook
```

Nothing about the request is invented for testing purposes: the method,
headers, signature, and body are exactly what your gateway is configured to
send — the same bytes a real payment provider's webhook would carry. Your
verification code is tested against the real thing, not a stand-in for it.

## Install

```bash
npm install -g mockgateway-cli
```

Requires Node 18 or newer. No dependencies.

## Quick start

**1. Sign in.** Copy a token from your MockGateway dashboard → Settings → CLI.

```bash
mockgateway login --token '<token>'
```

**2. Start listening**, pointing at whatever your app expects webhooks on:

```bash
mockgateway listen --forward-to http://localhost:3000/webhook
```

This prints a webhook URL. **Paste it into your gateway's webhook settings —
once.** It stays valid across restarts, reboots, and however long you leave
the CLI closed.

**3. Trigger a webhook** without running a full payment, to check your handler
quickly:

```bash
mockgateway trigger
```

## Commands

| Command | What it does |
| --- | --- |
| `login --token <token>` | Store your token in `~/.mockgateway/config.json` |
| `listen --forward-to <url> [--label <name>]` | Hold a connection open and forward webhooks to `<url>` |
| `trigger [--gateway <slug>] [--scenario <name>] [--label <name>]` | Send one webhook now, using your gateway's real payload and signature |
| `logs [--limit <n>]` | What was delivered recently |

Run more than one listener at once with `--label` — each label keeps its own
stable URL, so separate projects don't have to share one:

```bash
mockgateway listen --forward-to http://localhost:3000/hook --label shop
mockgateway listen --forward-to http://localhost:8000/webhook --label billing
```

## FAQ

**Does this expose my computer to the internet?**
No. The connection is outbound only — your machine calls MockGateway, not the
other way around. Nothing needs a public IP, a firewall rule, or port
forwarding.

**Will the webhook URL change if I restart my computer or the CLI?**
No. The same `--label` always resolves to the same listener and the same
URL, whether you ran it five minutes ago or five weeks ago.

**What happens if my Wi-Fi drops?**
The CLI reconnects on its own, with backoff, and says so in the terminal. It
also notices a connection that looks alive but has gone silent — the shape a
socket takes after a laptop sleeps — and reconnects from that too.

**What if my app is down when a webhook arrives?**
You'll see the failure in the terminal (e.g. `connection refused`) and in the
delivery log on your dashboard. Nothing retries automatically — CLI delivery
is a single attempt against a machine that's either there or it isn't.

**Can I run more than one at a time?**
Yes — see `--label` above.

**Does `trigger` really call my gateway, or is it a fake event?**
It's real: the same payload builder and signing logic that a live payment
uses, just without running a payment first.

## Requirements

Node 18 or newer. No dependencies.

## Links

- [MockGateway](https://mockgateway.com) — the payment gateway simulator this CLI connects to
- [Issues](https://github.com/mockgateway/mockgateway-cli/issues)

## License

MIT
