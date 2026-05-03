# DEV-20260503 Access Protection Evidence

- date: 2026-05-03
- scope: Kotovela Hub internal deployment
- branch: feature/snapshot-sync-ready

## Change Summary

- Added root `middleware.ts` to protect internal pages and `/api/*` when `KOTOVELA_ACCESS_SECRET` is configured.
- Added `/api/access` to exchange the access passcode for an HttpOnly cookie.
- Left public/demo deployments unaffected when `KOTOVELA_ACCESS_SECRET` is not configured.
- Stored the generated passcode outside Git under `.vercel/kotovela-access-passcode.txt`.

## Production Evidence

```text
GET https://kotovelahub.vercel.app/
status: 401
body: Kotovela Hub 访问验证

GET https://kotovelahub.vercel.app/api/model-usage
status: 401
body: {"error":"unauthorized"}

POST https://kotovelahub.vercel.app/api/access
status: 303
set-cookie: kotovela_access=<HttpOnly cookie>

GET https://kotovelahub.vercel.app/api/model-usage with cookie
status: 200
source: local-openclaw
agents: 6
recent_usage.totalTokens: 3282315
recent_usage.messageCount: 133

GET https://kotovelahub.vercel.app/api/office-instances with cookie
status: 200
source: live
instances: 6
```

## Local Office API Evidence

After increasing `OPENCLAW_STATUS_TIMEOUT_MS` default to 15 seconds and restarting `com.kotovela.office-api`:

```text
GET http://127.0.0.1:8787/api/model-usage
source: local-openclaw
agents: 6
recent_usage.totalTokens: 3245986
recent_usage.messageCount: 132
warnings: 0
```

## Verification Commands

```text
npm run lint
npm run build
vercel build --prod --yes
```

## Notes

- Vercel Authentication could not be tightened to `deploymentType: all` on the current plan for Production, so the app-level gate is the effective protection layer.
- Keep the passcode local and rotate `KOTOVELA_ACCESS_SECRET` if the URL or passcode is shared accidentally.
