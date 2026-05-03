# DEV-20260503 Model Usage Live Evidence

- date: 2026-05-03
- scope: Kotovela Hub internal deployment
- branch: feature/snapshot-sync-ready

## Change Summary

- Added `/api/model-usage` to the Mac-side `serve:office-api` service.
- Added Vercel server-side upstream proxy support for `/api/model-usage`.
- Kept the frontend route and payload shape unchanged.
- Kept upstream token only in Vercel/server env, not in the frontend bundle.
- Added a short Mac-side cache/warmup for model usage to avoid slow tunnel requests.

## Local Evidence

```text
GET http://127.0.0.1:8787/api/office-instances
source: live
count: 6

GET http://127.0.0.1:8787/api/model-usage
source: local-openclaw
agents: 6
recent_usage.totalTokens: 3980838
recent_usage.messageCount: 156
warnings: 0
```

## Tunnel Evidence

```text
GET https://rehab-socket-accordingly-closely.trycloudflare.com/api/model-usage
source: local-openclaw
agents: 6
recent_usage.totalTokens: 3980838
recent_usage.messageCount: 156
warnings: 0
```

## Production Evidence

```text
GET https://kotovelahub.vercel.app/api/office-instances
source: live
count: 6

GET https://kotovelahub.vercel.app/api/model-usage
source: local-openclaw
agents: 6
recent_usage.totalTokens: 3911325
recent_usage.messageCount: 154
warnings: 0

POST https://kotovelahub.vercel.app/api/office-instances -> 405
POST https://kotovelahub.vercel.app/api/model-usage -> 405
```

## Verification Commands

```text
npm run lint
npm run build
npm run build:internal
npm run build:opensource
OPENCLAW_RUNNER_ROOT=/Users/ztl/OpenClaw-Runner npm test
vercel build --prod --yes
vercel deploy --prebuilt --prod --yes --force --no-wait --debug --scope guoma970s-projects
```

## Operational Notes

- The current tunnel is a quick Cloudflare Tunnel URL, not a production-grade named tunnel.
- If the tunnel URL changes, update both `OFFICE_INSTANCES_UPSTREAM_URL` and `MODEL_USAGE_UPSTREAM_URL` in Vercel, then redeploy.
- Because this is an internal single-user cockpit, keep Vercel access protection or equivalent private access control enabled before broadly sharing the URL.
