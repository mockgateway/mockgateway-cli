# mockgateway-cli

The command-line companion to [MockGateway](https://mockgateway.com) — it
delivers your gateway's webhooks to `localhost` while you build, so you're
not exposing a tunnel or updating a webhook URL every time you restart.

MockGateway itself simulates Stripe, PayPal, Braintree, Adyen, Square,
Razorpay, and a dozen other payment providers, so you can build and test a
checkout without a merchant account or a single real transaction. This CLI is
the last piece: getting the webhooks it fires onto your machine.

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

## Where the URL goes

Paste the printed URL into your gateway's webhook field, under **Webhooks →
Configurations** in your MockGateway dashboard:

![Webhook URL field in the MockGateway dashboard](./assets/webhook-url-field.png)

You only do this once. Restart the CLI, reboot your laptop, come back next
month — the same URL keeps working.

## Why not just tunnel it

Every gateway you build has the same webhook loop: expose `localhost`, paste
the URL somewhere, test, and do it again tomorrow because the tunnel gave you
a new address overnight. That's the part this replaces.

| | a tunnel | mockgateway-cli |
| --- | --- | --- |
| Separate account | yes | no, uses your MockGateway login |
| URL changes | every restart | never |
| Update the webhook setting | every time | once |
| Machine reachable from the internet | yes | no |
| Delivery log | a separate dashboard | right in your terminal |

The URL is tied to your account, not to whatever socket happened to open
this time, which is why it doesn't move.

## How it works

MockGateway can't call your machine directly — it's behind NAT, a firewall,
or it's a laptop that isn't always on. So the CLI makes the connection the
other way: it dials out to MockGateway and holds that line open. When a
webhook fires, MockGateway writes it down that same line, and the CLI is the
one making the HTTP request to your `--forward-to` URL, from inside your own
network.

Nothing about the webhook is adjusted for this. Same method, same headers,
same signature your gateway is configured to send. Whatever you're testing
gets tested against the real thing, not a stand-in for it.

## Commands

| Command | What it does |
| --- | --- |
| `login --token <token>` | Store your token in `~/.mockgateway/config.json` |
| `listen --forward-to <url> [--label <name>]` | Hold a connection open and forward webhooks to `<url>` |
| `trigger [--gateway <slug>] [--scenario <name>] [--label <name>]` | Send one webhook now, without running a payment |
| `logs [--limit <n>]` | What was delivered recently |

`--label` names the listener — leave it out and you get one called
`default`. Give two projects different labels and they don't share a URL:

```bash
mockgateway listen --forward-to http://localhost:3000/hook --label shop
mockgateway listen --forward-to http://localhost:8000/webhook --label billing
```

`trigger --label billing` and `logs --label billing` then know which one
you mean.

## Requirements

Node 18 or newer. No dependencies.

## Links

- [MockGateway](https://mockgateway.com)
- [Issues](https://github.com/mockgateway/mockgateway-cli/issues)

## License

MIT
