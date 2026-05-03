const ACCESS_COOKIE_NAME = 'kotovela_access'
const ACCESS_HASH_PREFIX = 'kotovela-hub-access'

const textEncoder = new TextEncoder()

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const hashSecret = async (secret: string) =>
  toHex(await crypto.subtle.digest('SHA-256', textEncoder.encode(`${ACCESS_HASH_PREFIX}:${secret}`)))

const parseCookies = (cookieHeader: string | null) => {
  const cookies = new Map<string, string>()
  if (!cookieHeader) return cookies

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    cookies.set(name, decodeURIComponent(rest.join('=')))
  }

  return cookies
}

const isApiRequest = (pathname: string) => pathname.startsWith('/api/')

const shouldProtect = (secret: string | undefined) =>
  Boolean(secret) || process.env.VERCEL_BUILD_MODE === 'internal' || process.env.KOTOVELA_ACCESS_REQUIRED === '1'

const isAuthenticated = async (request: Request, secret: string) => {
  const expected = await hashSecret(secret)
  const cookies = parseCookies(request.headers.get('cookie'))
  const cookieValue = cookies.get(ACCESS_COOKIE_NAME)
  const automationToken = request.headers.get('x-kotovela-access-token')?.trim()

  return cookieValue === expected || automationToken === secret
}

const jsonResponse = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Vary': 'Cookie',
    },
  })

const loginPage = (request: Request, missingConfig = false) => {
  const url = new URL(request.url)
  const next = encodeURIComponent(`${url.pathname}${url.search}`)
  const failed = url.searchParams.get('access') === 'failed'
  const status = missingConfig ? 503 : 200
  const title = missingConfig ? '访问保护未配置' : 'Kotovela Hub 访问验证'
  const message = missingConfig
    ? '内部访问保护已开启，但服务端还没有配置 KOTOVELA_ACCESS_SECRET。'
    : failed
      ? '口令不正确，请重新输入。'
      : '这是个人内部驾驶舱，请输入访问口令继续。'

  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; font-family: "Avenir Next", "PingFang SC", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background:
      radial-gradient(circle at 20% 20%, rgba(45, 212, 191, .22), transparent 34rem),
      linear-gradient(145deg, #08111f, #111827 58%, #0c1324); color: #eef7ff; }
    main { width: min(92vw, 28rem); border: 1px solid rgba(148, 163, 184, .25); border-radius: 28px;
      padding: 2rem; background: rgba(15, 23, 42, .78); box-shadow: 0 24px 90px rgba(0,0,0,.45); }
    .eyebrow { color: #5eead4; font-size: .82rem; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 .7rem; }
    h1 { margin: 0; font-size: clamp(1.8rem, 8vw, 2.6rem); line-height: 1.05; }
    p { color: #b9c6d8; font-size: 1rem; line-height: 1.7; margin: 1rem 0 1.5rem; }
    form { display: grid; gap: .9rem; }
    input { width: 100%; box-sizing: border-box; border: 1px solid rgba(148, 163, 184, .3); border-radius: 16px;
      padding: .95rem 1rem; background: rgba(2, 6, 23, .72); color: #f8fafc; font: inherit; outline: none; }
    input:focus { border-color: #5eead4; box-shadow: 0 0 0 4px rgba(45, 212, 191, .16); }
    button { border: 0; border-radius: 16px; padding: 1rem 1.1rem; background: linear-gradient(135deg, #2dd4bf, #38bdf8);
      color: #04111d; font: inherit; font-weight: 800; cursor: pointer; }
    .hint { margin-top: 1rem; font-size: .86rem; color: #7f8ea3; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Kotovela Hub</p>
    <h1>${title}</h1>
    <p>${message}</p>
    ${
      missingConfig
        ? ''
        : `<form method="post" action="/api/access?next=${next}">
      <input name="password" type="password" autocomplete="current-password" placeholder="访问口令" required autofocus />
      <button type="submit">进入内部驾驶舱</button>
    </form>`
    }
    <div class="hint">真实实例状态与模型用量仅限本人查看。</div>
  </main>
</body>
</html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'Vary': 'Cookie',
      },
    },
  )
}

export const config = {
  matcher: ['/((?!favicon.ico|manifest\\.demo\\.webmanifest|manifest\\.internal\\.webmanifest).*)'],
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)
  if (url.pathname === '/api/access') return undefined

  const secret = process.env.KOTOVELA_ACCESS_SECRET?.trim()
  if (!shouldProtect(secret)) return undefined

  if (!secret) {
    return isApiRequest(url.pathname)
      ? jsonResponse({ error: 'access_protection_not_configured' }, 503)
      : loginPage(request, true)
  }

  if (await isAuthenticated(request, secret)) return undefined

  return isApiRequest(url.pathname) ? jsonResponse({ error: 'unauthorized' }, 401) : loginPage(request)
}
