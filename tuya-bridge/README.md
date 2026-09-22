# Tuya Message Service bridge for Ichiban Waiter Calls

This small Python service consumes Tuya's Pulsar-based Message Service and forwards Zigbee switch events to the Ichiban backend at `/api/public/tuya-events`.

Lovable (and most hosted frontends) cannot keep a permanent connection open to Tuya's Pulsar queue, so this bridge runs permanently on an external host and sends events over plain HTTPS to the app.

## What the bridge does

- Connects to Tuya Pulsar using your Access ID / Access Key.
- Decrypts each message with the middle 16 characters of your Access Key (Tuya's AES logic).
- Extracts `switch_type_N` click events (`single_click`, `double_click`, `long_click`).
- Forwards each event with `device_id`, `button`, `click_type` and a stable idempotency key.
- HMAC-signs every request with `LOVABLE_WEBHOOK_SECRET` so the backend can trust it.
- Acknowledges Pulsar messages only after the backend accepts them; failed forwards are negatively acknowledged and redelivered by Pulsar.
- Auto-reconnects when the connection drops.

## Files

- `main.py` — bridge entry point.
- `mq_authentication.py` — Tuya's Pulsar basic-auth generator.
- `message_util.py` — AES decryption helpers (Tuya-compatible).
- `requirements.txt` — Python dependencies.
- `Dockerfile` — container image.
- `railway.toml` / `Procfile` — Railway deployment hints.

## Required environment variables

| Variable | Value / where to get it |
|----------|--------------------------|
| `TUYA_ACCESS_ID` | Tuya Cloud project **Access ID / Client ID**. |
| `TUYA_ACCESS_KEY` | Tuya Cloud project **Access Secret / Client Secret**. |
| `TUYA_PULSAR_REGION` | `us`, `eu`, `cn`, `ind` or `sg`. Match your Tuya data-center region. |
| `TUYA_MQ_ENV` | `prod` (default) or `test`. Use `prod` for real devices. |
| `LOVABLE_ENDPOINT` | Your app's public URL, e.g. `https://project--xxxx.lovable.app`. |
| `LOVABLE_WEBHOOK_SECRET` | A strong random string. Must also be saved in the Lovable project as `TUYA_WEBHOOK_SECRET`. |
| `BRIDGE_LOG_LEVEL` | `INFO` (default), `DEBUG`, `WARNING` or `ERROR`. |

## Before deploying

1. In your Lovable project, add `TUYA_WEBHOOK_SECRET` to **Cloud → Secrets** if it is not there already.
2. In Tuya Cloud:
   - Make sure **Message Service** is enabled for your project.
   - Make sure the Zigbee button device for each table is authorized / subscribed to that project.
3. In the Ichiban app:
   - Go to **Settings → Physical buttons per table**.
   - Fill in each table's **Button device identifier** (Tuya `devId`).
   - Set the **Call** and **Mark attended** actions with the desired switch number and click type.
   - For table 700 the defaults are switch 3 / single click = call, switch 4 / single click = attended.

## Deploy on Railway (recommended)

Railway is the simplest host for a always-on Python worker.

1. **Create a Railway account** at https://railway.app (free trial, then roughly **US$5/month** for a small service).
2. **Create a new project** → **Deploy from GitHub repo**.
3. Select this repository and set the **Root Directory** to `tuya-bridge`.
4. Add the environment variables listed above in Railway's **Variables** tab.
5. Deploy. Railway will build the Dockerfile and keep the service running.
6. Watch the deploy logs to confirm the bridge connects to Tuya Pulsar.

### Estimated cost

A tiny Railway service with 1 vCPU / 512 MB RAM costs about **US$5/month**. The bridge uses very little CPU and only a few MB of memory.

## Local test (optional)

```bash
cd tuya-bridge
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export TUYA_ACCESS_ID=...
export TUYA_ACCESS_KEY=...
export TUYA_PULSAR_REGION=us
export TUYA_MQ_ENV=prod
export LOVABLE_ENDPOINT=https://your-project.lovable.app
export LOVABLE_WEBHOOK_SECRET=...
export BRIDGE_LOG_LEVEL=DEBUG

python main.py
```

If the backend is not yet deployed, you can still verify decryption by running with `LOVABLE_ENDPOINT` pointed at a local tunnel or by inspecting the logs.

## Security notes

- Credentials live only in Railway environment variables and the Lovable Cloud Secret.
- The bridge never exposes Tuya credentials to the browser.
- Every request is HMAC-signed with `LOVABLE_WEBHOOK_SECRET`; the Lovable endpoint rejects unsigned or incorrectly signed payloads.
