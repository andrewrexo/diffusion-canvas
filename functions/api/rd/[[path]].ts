const UPSTREAM = 'https://api.retrodiffusion.ai'

interface Context {
  request: Request
  params: { path?: string | string[] }
}

export async function onRequest({ request, params }: Context): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '')
  const search = new URL(request.url).search

  const headers = new Headers()
  for (const name of ['X-RD-Token', 'Content-Type', 'Accept', 'User-Agent']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const upstream = await fetch(`${UPSTREAM}/${path}${search}`, {
    method: request.method,
    headers,
    body: request.method === 'POST' ? request.body : undefined,
  })
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
