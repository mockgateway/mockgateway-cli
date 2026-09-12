# mockgateway-cli

Receive [MockGateway](https://mockgateway.com) webhooks on `localhost`, without a tunnel.

```bash
npm install -g mockgateway-cli
```

## Why

A tunnel gives you a new URL every time it restarts, so the webhook settings have
to be updated again. This one never changes — paste it into your gateway once.

|                       | ngrok | mockgateway-cli |
| --------------------- | ----- | --------------- |
| Separate account      | yes   | no              |
| URL changes           | every restart | never   |
| Exposed to the internet | yes | no            |
| Event log             | no    | in your terminal |

Your machine opens the connection outward, so nothing has to reach it from
outside — NAT, firewalls and corporate networks are not in the way.

## Use

```bash
mockgateway login --token '<token>'     # from Settings → CLI
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

Webhooks arrive with the headers a real provider sends, signature included, so
your verification code is what gets tested.

## Commands

| Command | What it does |
| ------- | ------------ |
| `login --token <token>` | Store your token in `~/.mockgateway/config.json` |
| `listen --forward-to <url>` | Hold a connection open and forward webhooks |
| `trigger` | Send one webhook now, without running a payment |
| `logs` | What was delivered recently |

`listen` and `trigger` take `--label <name>` to run more than one listener —
each label keeps its own stable URL.

`trigger` takes `--gateway <slug>` and `--scenario <name>` to choose what to
send. It sends the gateway's real payload and signature, not a stand-in.

## Self-hosted

```bash
export MOCKGATEWAY_API_URL=https://mockgateway.example.com
```

`MOCKGATEWAY_TOKEN` overrides the stored token, which is useful in CI.

## Requirements

Node 18 or newer. No dependencies.

## License

MIT
