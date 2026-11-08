# Nova Optimize — Official Download & Documentation Website

This repository contains the static download and documentation portal for **Nova Optimize (`v1.0.0`)**, a free, local-first Windows 10/11 gaming performance and network latency suite.

## Security & Privacy Architecture
- **Zero Secrets / Zero API Keys:** This website is 100% static/self-contained and uses no API keys, external databases, or secret environment variables.
- **Zero Telemetry & Zero Cookies:** Neither this website nor the Nova Optimize desktop application collects, logs, or transmits personal data.
- **Strict HTTP Security Headers:** Configured in both [`render.yaml`](./render.yaml) and [`server.js`](./server.js) (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`).

## Deploying on Render
You can deploy this repository on Render in two ways:
1. **Static Site (Recommended, Free):**
   - **Build Command:** *(leave blank)*
   - **Publish Directory:** `.`
2. **Web Service (Node.js):**
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`

## Legal Notice
See [`LEGAL.md`](./LEGAL.md) and [`LICENSE`](./LICENSE) for the full "AS-IS" Warranty Disclaimer, Assumption of Risk, Limitation of Liability, Privacy Policy, and MIT License.

