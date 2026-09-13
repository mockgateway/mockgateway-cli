# mockgateway-cli

The command-line companion to [MockGateway](https://mockgateway.com), a
payment gateway simulator for Stripe, PayPal, Braintree, Adyen, Square,
Razorpay, and a dozen other providers. This CLI delivers your gateway's
webhooks to `localhost` while you build, so there's no tunnel to expose and
no webhook URL to update every time you restart.

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

Do this once. It keeps working after a restart, a reboot, or a month away.

## Why not just tunnel it

A tunnel gives you a new address every time it restarts, so the webhook
setting has to be updated again. This URL doesn't move, because it's tied to
your MockGateway account, not to a socket.

| | a tunnel | mockgateway-cli |
| --- | --- | --- |
| Separate account | yes | no |
| URL changes | every restart | never |
| Update the webhook setting | every time | once |
| Machine reachable from the internet | yes | no |
| Delivery log | a separate dashboard | your terminal |

## How it works

MockGateway can't call your machine directly: it's behind NAT, a firewall,
or a laptop that isn't always on. So the CLI connects out to MockGateway and
holds that line open. When a webhook fires, MockGateway sends it down the
line, and the CLI makes the actual HTTP request to your `--forward-to` URL
from inside your own network.

The webhook itself isn't changed for this. Same method, headers, and
signature your gateway is configured to send.

## Commands

| Command | What it does |
| --- | --- |
| `login --token <token>` | Store your token in `~/.mockgateway/config.json` |
| `listen --forward-to <url> [--label <name>]` | Hold a connection open and forward webhooks to `<url>` |
| `trigger [--gateway <slug>] [--scenario <name>] [--label <name>]` | Send one webhook now, without running a payment |
| `logs [--limit <n>]` | What was delivered recently |

`--label` names the listener. Leave it out and you get one called `default`.
Give two projects different labels and they don't share a URL:

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
